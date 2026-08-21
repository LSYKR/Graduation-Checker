import type { SupportedStudentType } from "./onboarding";
import type { TransferRecognitionSummary } from "./transcript-profile";
import { getKmouProgramOffering } from "./kmou-program-catalog";
import { getBundledMajorCourseCatalog, getVerifiedRequiredCourseOverlay } from "./verified-major-curricula";

export type EvidenceState = "verified" | "provisional" | "review" | "pending" | "missing";

export interface RuleAvailability {
  admissionYear: number;
  studentType: SupportedStudentType;
  creditSummary: EvidenceState;
  detailedCurriculum: EvidenceState;
  generalEducation: EvidenceState;
  generalEducationAreaMapping: EvidenceState;
  generalEducationSpecialRecognition: EvidenceState;
  graduationCertification: EvidenceState;
  transferOverlay: EvidenceState;
  individualTransferRecognition: EvidenceState;
  requiredCourseTransitions: EvidenceState;
  operational: "provisional" | "blocked";
  message: string;
}

export function getRuleAvailability(
  admissionYear: number,
  departmentId: string,
  studentType: SupportedStudentType,
  transferRecognition?: TransferRecognitionSummary,
): RuleAvailability {
  const offering = getKmouProgramOffering(admissionYear, departmentId);
  const supportedCurriculumYear = Boolean(offering);
  const detectedRecognition = transferRecognition?.status === "detected";
  const detailedCatalog = getBundledMajorCourseCatalog({ universityId: "kmou", admissionYear, departmentId });
  const detailed2022Computer = admissionYear === 2022 && departmentId === "computer-engineering";
  const requiredCourseOverlay = getVerifiedRequiredCourseOverlay({ universityId: "kmou", admissionYear, departmentId });
  const matched2024Overlay = studentType === "transfer"
    && detailed2022Computer
    && detectedRecognition
    && transferRecognition.years.length === 1
    && transferRecognition.years[0] === 2024;
  const profileReadyForProvisional = supportedCurriculumYear && (studentType === "freshman" || detectedRecognition);

  return {
    admissionYear,
    studentType,
    creditSummary: supportedCurriculumYear ? "provisional" : "missing",
    detailedCurriculum: detailedCatalog?.requiredCourseSetStatus === "verified"
      ? "verified"
      : detailedCatalog ? "provisional" : requiredCourseOverlay ? "provisional" : supportedCurriculumYear ? "review" : "missing",
    generalEducation: supportedCurriculumYear ? "verified" : "missing",
    generalEducationAreaMapping: supportedCurriculumYear ? "verified" : "missing",
    generalEducationSpecialRecognition: detailed2022Computer ? "verified" : supportedCurriculumYear ? "review" : "missing",
    graduationCertification: detailed2022Computer ? "provisional" : admissionYear <= 2025 && supportedCurriculumYear ? "verified" : "pending",
    transferOverlay: studentType === "transfer"
      ? matched2024Overlay ? "provisional" : detectedRecognition ? "pending" : "missing"
      : "missing",
    individualTransferRecognition: studentType === "transfer"
      ? detectedRecognition ? "verified" : transferRecognition?.status === "ambiguous" ? "pending" : "missing"
      : "missing",
    requiredCourseTransitions: detailed2022Computer ? "provisional" : detailedCatalog ? "review" : requiredCourseOverlay ? "review" : "missing",
    operational: profileReadyForProvisional ? "provisional" : "blocked",
    message: profileReadyForProvisional && detailed2022Computer
      ? "전공 교육과정과 교양 세부영역은 공식 교과목번호로 대조합니다. 확인된 대체과목은 전공필수에 한 번만 반영하며 졸업인증은 최종 졸업사정 전 별도 확인이 필요합니다."
      : profileReadyForProvisional && detailedCatalog?.requiredCourseSetStatus === "verified"
        ? "입학학년도의 공식 4년 전공표를 교과목번호로 대조합니다. 전공기초·전공필수의 확정 미이수 과목을 표시하며 폐지·대체과목은 최종 졸업사정 전 확인이 필요합니다."
      : profileReadyForProvisional && detailedCatalog
        ? "입학학년도의 공식 상세 전공표로 과목코드와 이수구분을 대조합니다. 원문 안의 편제학점 차이가 남은 필수과목은 확인 필요로 분리합니다."
      : profileReadyForProvisional && requiredCourseOverlay
        ? `입학학년도의 공식 신입생 1학기 표에서 전공 교과목 ${requiredCourseOverlay.classificationEntries.length}개를 교과목번호로 분류하고, 그중 전공필수 ${requiredCourseOverlay.courses.length}개만 미이수 대조에 사용합니다. 전체 4년 필수과목표와 대체·폐지 목록은 추가 검수 중입니다.`
      : profileReadyForProvisional
        ? "공식 편제표와 선택 전공의 과목명 지문을 함께 확인합니다. 전공 지문이 충분히 일치할 때만 성적표의 영역별 전공학점과 전체 준비도를 표시합니다."
      : supportedCurriculumYear && studentType === "transfer"
        ? "편입 인정학점 행과 처리 연도를 확정하지 못해 임시 진단을 열지 않습니다. 성적표의 ‘편입생 인정학점’ 표시를 확인해주세요."
        : "선택한 학번·전공의 정확한 편제학점 규칙이 없어 진단을 열지 않습니다.",
  };
}

export function evidenceLabel(state: EvidenceState): string {
  if (state === "verified") return "원본·코드 최종 확인";
  if (state === "provisional") return "임시 승인 · 재확인 필요";
  if (state === "review") return "근거 연결 완료 · 검수 중";
  if (state === "pending") return "공식 자료 확인 · 원본 고정 대기";
  return "추가 수집 필요";
}
