import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const outputDir = path.join(process.cwd(), "public", "icons", "cat-actions");

const modelCandidates = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1"];

const sharedPrompt = [
  "A small hand-drawn app icon for a Japanese cat care app.",
  "Soft charcoal line art, warm minimal style, slightly imperfect human-drawn feeling, not AI-looking.",
  "Transparent background, simple shape, readable at small size, gentle and friendly.",
  "No text, no photorealism, no 3D, no glossy effect, no sticker border.",
  "Limited color palette with a tiny warm orange accent if needed, consistent style across the icon set.",
].join(" ");

const icons = [
  {
    file: "sleeping.png",
    motif: "a cat curled up sleeping peacefully",
  },
  {
    file: "grooming.png",
    motif: "a cat gently grooming itself",
  },
  {
    file: "playing.png",
    motif: "a cat playing with a yarn ball or small toy",
  },
  {
    file: "food.png",
    motif: "a small cat food bowl with kibble",
  },
  {
    file: "toilet.png",
    motif: "a simple cat litter box",
  },
  {
    file: "purring.png",
    motif: "a relaxed cat face with tiny soft vibration lines or a small heart",
  },
  {
    file: "meowing.png",
    motif: "a cat face gently meowing with soft sound waves",
  },
  {
    file: "following.png",
    motif: "small cat paw prints following behind",
  },
  {
    file: "restless.png",
    motif: "restless small paw prints or gentle wavy motion lines",
  },
  {
    file: "low_energy.png",
    motif: "a slightly tired cat sitting quietly, gentle not sad",
  },
  {
    file: "fighting.png",
    motif: "two small cats facing each other, mild disagreement, not scary",
  },
  {
    file: "unknown.png",
    motif: "a cat face with a small question mark motif, no text",
  },
];

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const [rawKey, ...rawValue] = trimmed.split("=");
    const key = rawKey.trim();

    if (key !== "OPENAI_API_KEY" || process.env.OPENAI_API_KEY) {
      continue;
    }

    process.env.OPENAI_API_KEY = rawValue.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

function isModelFallbackError(error) {
  const status = error?.status ?? error?.response?.status;
  const message = String(error?.message ?? "").toLowerCase();

  return (
    status === 400 ||
    status === 404 ||
    message.includes("model") ||
    message.includes("unsupported") ||
    message.includes("not found")
  );
}

async function generateWithFallback(client, prompt) {
  let lastError;

  for (const model of modelCandidates) {
    try {
      const result = await client.images.generate({
        model,
        prompt,
        size: "1024x1024",
        quality: "medium",
        background: "transparent",
        output_format: "png",
      });

      const image = result.data?.[0];
      const b64 = image?.b64_json;

      if (!b64) {
        throw new Error(`No image data returned by ${model}`);
      }

      return { model, buffer: Buffer.from(b64, "base64") };
    } catch (error) {
      lastError = error;

      if (!isModelFallbackError(error) || model === modelCandidates.at(-1)) {
        throw error;
      }

      console.warn(`${model} was not available. Trying next GPT Image model...`);
    }
  }

  throw lastError ?? new Error("Image generation failed.");
}

async function main() {
  loadLocalEnv();

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set. No icons were generated.");
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const usedModels = new Set();

  for (const icon of icons) {
    const prompt = `${sharedPrompt} Subject: ${icon.motif}. Centered icon composition with generous whitespace.`;
    const { model, buffer } = await generateWithFallback(client, prompt);
    const outputPath = path.join(outputDir, icon.file);

    fs.writeFileSync(outputPath, buffer);
    usedModels.add(model);
    console.log(`generated ${icon.file} with ${model}`);
  }

  console.log(`Generated ${icons.length} icons in ${outputDir}`);
  console.log(`Models used: ${Array.from(usedModels).join(", ")}`);
}

main().catch((error) => {
  console.error("Icon generation failed.");
  console.error(error?.message ?? error);
  process.exitCode = 1;
});
