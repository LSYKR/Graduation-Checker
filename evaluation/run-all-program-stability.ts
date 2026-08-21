import { DUMMY_DATA_NOTICE } from "./dummy-transcripts";
import { runAllProgramStability } from "./program-stability";
import { runResidualCreditStability } from "./residual-credit-stability";

const summary = runAllProgramStability();
const residualSummary = runResidualCreditStability();

console.log(JSON.stringify({
  status: "passed",
  notice: DUMMY_DATA_NOTICE,
  ...summary,
  residualAccounting: residualSummary,
  combinedAuditCount: summary.totalAudits + residualSummary.audits,
}, null, 2));
