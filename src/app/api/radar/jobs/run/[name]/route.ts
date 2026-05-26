import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/radar-auth";

interface Params { params: Promise<{ name: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { name } = await params;

  try {
    let result: unknown;
    switch (name) {
      case "reconstructStageHistory": {
        const { runReconstructStageHistory } = await import("@/jobs/reconstructStageHistory");
        result = await runReconstructStageHistory();
        break;
      }
      case "runMetricValidations": {
        const { runMetricValidations } = await import("@/jobs/runMetricValidations");
        result = await runMetricValidations();
        break;
      }
      case "computeMetricResults": {
        const { runComputeMetricResults } = await import("@/jobs/computeMetricResults");
        result = await runComputeMetricResults();
        break;
      }
      default:
        return NextResponse.json({ error: `job desconhecido: ${name}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
