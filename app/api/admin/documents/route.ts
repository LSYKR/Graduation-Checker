import { requireAdmin } from "@/lib/server/admin-auth";
import { uploadOfficialDocument } from "@/lib/server/ingestion-service";
import { listSourceDocuments } from "@/lib/server/rule-repository";
import { errorResponse, json } from "@/lib/server/request-utils";
import type { DocumentTargetKey, StudentType } from "@/lib/types";

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    return json({ documents: await listSourceDocuments() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("업로드할 공식 문서가 필요합니다.");

    const studentType = String(form.get("studentType") ?? "transfer") as StudentType;
    const transferEntryYearValue = form.get("transferEntryYear");
    const transferEntryYear = transferEntryYearValue ? Number(transferEntryYearValue) : undefined;
    if (studentType === "transfer" && (!Number.isInteger(transferEntryYear) || Number(transferEntryYear) < 1900)) {
      throw new Error("편입생 공식 문서에는 편입 처리 연도가 필요합니다.");
    }

    const key: DocumentTargetKey = {
      universityId: String(form.get("universityId") ?? "kmou"),
      admissionYear: Number(form.get("admissionYear") ?? 2022),
      transferEntryYear,
      departmentId: String(form.get("departmentId") ?? "computer-engineering"),
      studentType,
    };
    return json({ document: await uploadOfficialDocument(file, key) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
