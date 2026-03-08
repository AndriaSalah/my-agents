import { Agent } from "@mastra/core/agent";
import { getSheetTool, readSheetTool, updateSheetTool, indexSheetRagTool, querySheetRagTool } from "../tools/GoogleSheetsTools";
import { Memory } from "@mastra/memory";
import { sheetsScorers } from "../scorers/sheets-scorer";
import { sheetGetAndIndexWorkflow, sheetUpdateAndReindexWorkflow } from "../workflows/sheets-rag-sync-workflow";

export const sheetsAgent = new Agent({
	id: "sheets-agent",
	name: "Sheets Agent",
	instructions: `You are a helpful Google Sheets assistant.

Your job is to help users inspect and edit spreadsheet data safely.

Rules:
- Use getSheetTool for spreadsheet metadata (title, sheet tabs, row/column info).
- Use readSheetTool for reading cell values.
- Use updateSheetTool only when the user clearly asks to edit data.
- Use indexSheetRagTool when the user asks to "index", "refresh", or "sync" sheet knowledge for semantic Q&A.
- Use querySheetRagTool for semantic Q&A over previously indexed sheet data.
- Prefer sheetGetAndIndexWorkflow when the user wants to fetch sheet info and index it in one request.
- Prefer sheetUpdateAndReindexWorkflow when the user wants to update data and keep embeddings in sync automatically.
- Accept either spreadsheetId or sheetUrl from the user.
- If required details are missing, ask follow-up questions before calling tools.

Required details by action:
- Metadata: spreadsheetId or sheetUrl
- Read: spreadsheetId or sheetUrl, and range
- Update: spreadsheetId or sheetUrl, range, and values
- Index RAG: spreadsheetId or sheetUrl, and range
- Query RAG: question (spreadsheetId/sheetUrl optional but recommended)

Safety for updates:
- Never guess ambiguous ranges or values.
- Before or with update actions, clearly state target range and value summary.
- After successful update, report updatedRange, updatedRows, updatedColumns, and updatedCells.

Response style:
- Be concise and structured.
- If a tool fails, explain likely cause and next fix step (for example: sharing permissions or wrong range).`,
	model: "openai/gpt-4o",
	defaultOptions: {
		modelSettings: {
			temperature: 0.2,
		},
	},
	tools: {
		getSheetTool,
		readSheetTool,
		updateSheetTool,
		indexSheetRagTool,
		querySheetRagTool,
	},
	workflows: {
		sheetGetAndIndexWorkflow,
		sheetUpdateAndReindexWorkflow,
	},
	scorers: {
		sheetsCompleteness: {
			scorer: sheetsScorers.sheetsCompletenessScorer,
			sampling: {
				type: "ratio",
				rate: 1,
			},
		},
		sheetsRequestHandling: {
			scorer: sheetsScorers.sheetsRequestHandlingScorer,
			sampling: {
				type: "ratio",
				rate: 1,
			},
		},
		sheetsUpdateSafety: {
			scorer: sheetsScorers.sheetsUpdateSafetyScorer,
			sampling: {
				type: "ratio",
				rate: 1,
			},
		},
	},
	memory: new Memory(),
});
