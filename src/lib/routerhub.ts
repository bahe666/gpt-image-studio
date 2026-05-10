export interface GenerateImageParams {
  prompt: string;
  size: string;
  quality: string;
}

export interface GenerateImageResult {
  success: boolean;
  image?: string;
  error?: string;
}

export async function generateImage(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const apiKey = process.env.ROUTERHUB_API_KEY;
  if (!apiKey) {
    return { success: false, error: "ROUTERHUB_API_KEY 未配置" };
  }

  const res = await fetch("https://api.routerhub.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-image-2",
      prompt: params.prompt,
      size: params.size,
      quality: params.quality,
      n: 1,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text();
    return { success: false, error: `API 错误 (${res.status}): ${body}` };
  }

  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    return { success: false, error: "API 返回中没有图片数据" };
  }

  return { success: true, image: b64 };
}
