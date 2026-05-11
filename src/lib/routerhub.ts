export interface Attachment {
  base64: string;
  type: string;
  name: string;
  text?: string;
}

export interface GenerateImageParams {
  prompt: string;
  size: string;
  quality: string;
  format: string;
  svgModel?: string;
  attachments?: Attachment[];
}

export interface GenerateImageResult {
  success: boolean;
  image?: string;
  svg?: string;
  pptx?: string;
  pptxLayout?: object;
  error?: string;
}

function isImageType(mime: string) {
  return mime.startsWith("image/");
}

function buildAttachmentContext(attachments: Attachment[]): string {
  const docs = attachments.filter((a) => !isImageType(a.type) && a.text);
  if (docs.length === 0) return "";
  return docs.map((d) => `--- ${d.name} ---\n${d.text}`).join("\n\n");
}

export async function generateImage(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const apiKey = process.env.ROUTERHUB_API_KEY;
  if (!apiKey) {
    return { success: false, error: "ROUTERHUB_API_KEY 未配置" };
  }

  if (params.format === "svg") {
    return generateSVG(
      apiKey,
      params.prompt,
      params.svgModel || "openai/gpt-5.5",
      params.attachments
    );
  }

  if (params.format === "pptx") {
    return generatePPTX(
      apiKey,
      params.prompt,
      params.svgModel || "openai/gpt-5.5",
      params.attachments
    );
  }

  const docContext = buildAttachmentContext(params.attachments || []);
  let finalPrompt = params.prompt;
  if (docContext) {
    finalPrompt = `Based on the following document content, ${params.prompt || "generate an image that visualizes the key concepts"}:\n\n${docContext}`;
  }

  const res = await fetch("https://api.routerhub.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-image-2",
      prompt: finalPrompt,
      size: params.size,
      quality: params.quality,
      output_format: params.format,
      n: 1,
    }),
    signal: AbortSignal.timeout(300_000),
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

async function generateSVG(
  apiKey: string,
  prompt: string,
  model: string,
  attachments?: Attachment[]
): Promise<GenerateImageResult> {
  const images = (attachments || []).filter((a) => isImageType(a.type));
  const docContext = buildAttachmentContext(attachments || []);
  const hasImage = images.length > 0;

  const textRules = `
Text & Font Rules (critical for PowerPoint compatibility):
- Chinese text: font-family="Microsoft YaHei"
- English text: font-family="Times New Roman"
- Mixed text: font-family="Microsoft YaHei, Times New Roman"
- Always set font-family, font-size, font-weight, fill directly as attributes on each <text> element. NEVER use CSS <style> blocks for text styling.
- font-size MUST use pt units (e.g. font-size="14pt", font-size="18pt"). Never use unitless numbers or px for font-size.
- Always set explicit width and height on <svg> matching the viewBox, e.g. <svg width="800" height="600" viewBox="0 0 800 600"> so there is a 1:1 mapping with no scaling.
- Each line of text must be a separate <text> element. Do NOT use <tspan> for multi-line text.
- Do NOT use textLength, letter-spacing, word-spacing, or writing-mode attributes.
- Always include xmlns="http://www.w3.org/2000/svg" on the <svg> element.`;

  let systemPrompt: string;
  if (hasImage) {
    systemPrompt = `You are an expert SVG illustrator. Convert the provided image into clean, well-structured SVG code. Faithfully reproduce the shapes, colors, layout, and overall composition of the original image.

Rules:
- Output ONLY the SVG code, nothing else — no markdown fences, no explanation.
- Start with <svg and end with </svg>.
- Use viewBox for responsive sizing. Match the aspect ratio of the original image.
- Reproduce colors as accurately as possible using hex codes.
- Use appropriate SVG elements: paths for complex shapes, circles/rects/ellipses for simple ones.
- Use gradients, filters, and clip-paths when they help match the original.
- Layer elements from back to front.
- If the user provides additional instructions, follow them while staying faithful to the source image.
${textRules}`;
  } else {
    systemPrompt = `You are an expert SVG illustrator. Generate clean, well-structured SVG code based on the user's description.

Rules:
- Output ONLY the SVG code, nothing else — no markdown fences, no explanation.
- Start with <svg and end with </svg>.
- Use viewBox for responsive sizing. Default to viewBox="0 0 800 600" unless the content needs different proportions.
- Use modern SVG features: gradients, filters, clip-paths when they improve the result.
- Keep the code reasonably concise but visually rich.
- Use descriptive colors and shapes to create appealing illustrations.
- For complex scenes, layer elements from back to front.
${textRules}`;
  }

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

  const userContent: ContentPart[] = [];

  for (const img of images) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${img.type};base64,${img.base64}` },
    });
  }

  let textPart = prompt || "";
  if (docContext) {
    textPart = `${textPart ? textPart + "\n\n" : ""}Reference document:\n${docContext}`;
  }
  if (!textPart && hasImage) {
    textPart = "Convert this image to SVG.";
  }

  userContent.push({ type: "text", text: textPart });

  const isReasoning = model.includes("gpt-5") || model.includes("o1");

  const requestBody: Record<string, unknown> = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    max_tokens: 16000,
  };
  if (!isReasoning) {
    requestBody.temperature = 0.7;
  }

  const res = await fetch("https://api.routerhub.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const body = await res.text();
    return { success: false, error: `SVG 生成错误 (${res.status}): ${body}` };
  }

  const json = await res.json();
  let svgText = json?.choices?.[0]?.message?.content ?? "";

  const fenceMatch = svgText.match(/```(?:svg|xml)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    svgText = fenceMatch[1].trim();
  }

  const svgStart = svgText.indexOf("<svg");
  const svgEnd = svgText.lastIndexOf("</svg>");
  if (svgStart === -1 || svgEnd === -1) {
    return { success: false, error: "模型未返回有效的 SVG 代码" };
  }
  svgText = svgText.slice(svgStart, svgEnd + 6);

  return { success: true, svg: svgText };
}

async function generatePPTX(
  apiKey: string,
  prompt: string,
  model: string,
  attachments?: Attachment[]
): Promise<GenerateImageResult> {
  const { buildPptx } = await import("@/lib/pptx");
  const images = (attachments || []).filter((a) => isImageType(a.type));
  const docContext = buildAttachmentContext(attachments || []);
  const hasImage = images.length > 0;

  const systemPrompt = `You are a PowerPoint slide designer. Generate a JSON object that describes a PowerPoint presentation layout.

The JSON must follow this exact schema:
{
  "slides": [
    {
      "background": { "color": "#FFFFFF" },
      "elements": [
        // Text box with optional fill and border (acts as a labeled shape):
        { "type": "text", "text": "内容", "x": 1, "y": 0.5, "w": 4, "h": 0.8, "fontSize": 14, "fontFace": "Microsoft YaHei", "color": "#333333", "bold": false, "align": "center", "valign": "middle", "fill": "#E8F0FE", "borderColor": "#4472C4", "borderWidth": 1, "borderRadius": 0.1 },
        // Plain rectangle (background shape, no text):
        { "type": "rect", "x": 0.5, "y": 1.5, "w": 5, "h": 3, "fill": "#F5F5F5", "borderColor": "#CCCCCC", "borderWidth": 1 },
        // Line (connectors, arrows):
        { "type": "line", "x1": 3, "y1": 2, "x2": 3, "y2": 3.5, "color": "#666666", "width": 1.5, "dash": "solid" },
        // Ellipse/circle:
        { "type": "circle", "x": 2, "y": 2, "w": 1.5, "h": 1.5, "fill": "#4472C4", "borderColor": "#2F5597" }
      ]
    }
  ]
}

Rules:
- Output ONLY valid JSON. No markdown fences, no explanation, no comments.
- Slide dimensions are 13.33 x 7.5 inches (widescreen 16:9). All x/y/w/h values are in inches.
- Keep all elements within bounds: x+w <= 13.33, y+h <= 7.5.
- Chinese text: fontFace = "Microsoft YaHei". English text: fontFace = "Times New Roman".
- Default fontSize: titles 24-28, subtitles 16-18, body 11-13, small labels 9-10.
- Use "text" type with fill/border for labeled boxes, cards, and badges. This is the primary way to create shapes with text.
- Use "rect" type ONLY for background shapes that have no text.
- Use "line" type for connectors between elements. dash can be "solid", "dash", or "dot".
- Leave generous padding inside text boxes — at least 0.15 inches on each side.
- Make sure text fits comfortably within its w/h. For Chinese text, estimate ~0.25 inches per character at 12pt.
- Use harmonious color palettes. For org charts / diagrams, use blue tones (#4472C4, #2F5597, #E8F0FE).
- For multi-level diagrams: use clear hierarchy with consistent spacing and alignment.
- Maximum 1 slide unless the content clearly needs multiple slides.`;

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

  const userContent: ContentPart[] = [];

  for (const img of images) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${img.type};base64,${img.base64}` },
    });
  }

  let textPart = prompt || "";
  if (docContext) {
    textPart = `${textPart ? textPart + "\n\n" : ""}Reference document:\n${docContext}`;
  }
  if (!textPart && hasImage) {
    textPart = "Recreate this image as a PowerPoint slide.";
  }

  userContent.push({ type: "text", text: textPart });

  const isReasoning = model.includes("gpt-5") || model.includes("o1");

  const requestBody: Record<string, unknown> = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    max_tokens: 16000,
  };
  if (!isReasoning) {
    requestBody.temperature = 0.7;
  }

  const res = await fetch("https://api.routerhub.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const body = await res.text();
    return { success: false, error: `PPTX 生成错误 (${res.status}): ${body}` };
  }

  const json = await res.json();
  let content = json?.choices?.[0]?.message?.content ?? "";

  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  }

  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    return { success: false, error: "模型未返回有效的 PPTX 布局数据" };
  }
  content = content.slice(jsonStart, jsonEnd + 1);

  let layout;
  try {
    layout = JSON.parse(content);
  } catch {
    return { success: false, error: "PPTX 布局 JSON 解析失败" };
  }

  try {
    const pptxBase64 = await buildPptx(layout);
    return { success: true, pptx: pptxBase64, pptxLayout: layout };
  } catch (e) {
    return {
      success: false,
      error: `PPTX 文件生成失败: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
