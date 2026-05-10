import { generateImage } from "@/lib/routerhub";

export const maxDuration = 120;

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
  if (!prompt) {
    return Response.json(
      { success: false, error: "请输入 Prompt" },
      { status: 400 }
    );
  }

  const result = await generateImage({
    prompt,
    size: body.size || "1024x1024",
    quality: body.quality || "medium",
  });

  return Response.json(result, { status: result.success ? 200 : 502 });
}
