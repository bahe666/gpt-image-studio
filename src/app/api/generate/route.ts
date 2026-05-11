import { generateImage } from "@/lib/routerhub";
import type { Attachment } from "@/lib/routerhub";

export const maxDuration = 300;

async function extractText(
  base64: string,
  type: string
): Promise<string | undefined> {
  if (type.startsWith("image/")) return undefined;

  const buffer = Buffer.from(base64, "base64");

  if (type === "application/pdf") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    type === "text/plain" ||
    type === "text/markdown" ||
    type === "text/csv" ||
    type === "application/json"
  ) {
    return buffer.toString("utf-8");
  }

  return buffer.toString("utf-8");
}

export async function POST(request: Request) {
  const body = await request.json();

  const accessPassword = process.env.ACCESS_PASSWORD;
  if (accessPassword && body.password !== accessPassword) {
    return Response.json(
      { success: false, error: "访问密码错误" },
      { status: 401 }
    );
  }

  const prompt = body.prompt?.trim();
  const rawAttachments: Array<{
    base64: string;
    type: string;
    name: string;
  }> = body.attachments || [];

  if (!prompt && rawAttachments.length === 0) {
    return Response.json(
      { success: false, error: "请输入 Prompt 或上传文件" },
      { status: 400 }
    );
  }

  const attachments: Attachment[] = [];
  for (const raw of rawAttachments) {
    try {
      const text = await extractText(raw.base64, raw.type);
      attachments.push({ ...raw, text });
    } catch {
      attachments.push({ ...raw });
    }
  }

  try {
    const result = await generateImage({
      prompt: prompt || "",
      size: body.size || "1024x1024",
      quality: body.quality || "medium",
      format: body.format || "png",
      svgModel: body.svgModel,
      attachments,
    });

    return Response.json(result, { status: result.success ? 200 : 502 });
  } catch (e) {
    const isTimeout =
      e instanceof Error &&
      (e.name === "TimeoutError" || e.name === "AbortError");
    return Response.json(
      {
        success: false,
        error: isTimeout
          ? "生成超时，请尝试降低质量或简化 Prompt 后重试"
          : `服务器错误: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
