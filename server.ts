import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse large JSON payloads (for base64 images)
  app.use(express.json({ limit: '10mb' }));

  // API routes FIRST
  app.post("/api/identify", async (req, res) => {
    try {
      const { base64Image } = req.body;
      if (!base64Image) {
        return res.status(400).json({ error: "Missing image data" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const prompt = "Identify the fruit in this image. Return a JSON object with the following fields: name (Chinese name), scientificName, family, origin, nutrition (object with calories, vitamins (array), minerals (array)), funFact, season.";
      
      const imagePart = {
        inlineData: {
          data: base64Image.split(',')[1],
          mimeType: "image/jpeg",
        },
      };

      const aiPromise = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }, imagePart] }],
        config: {
          systemInstruction: "You are a professional botanist and nutritionist. Your task is to accurately identify fruits from images and provide detailed, scientifically accurate information in a structured JSON format. Always use Chinese for the 'name' field.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              scientificName: { type: Type.STRING },
              family: { type: Type.STRING },
              origin: { type: Type.STRING },
              nutrition: {
                type: Type.OBJECT,
                properties: {
                  calories: { type: Type.STRING },
                  vitamins: { type: Type.ARRAY, items: { type: Type.STRING } },
                  minerals: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["calories", "vitamins", "minerals"],
              },
              funFact: { type: Type.STRING },
              season: { type: Type.STRING },
            },
            required: ["name", "scientificName", "family", "origin", "nutrition", "funFact", "season"],
          },
        },
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 10000)
      );

      const result = await Promise.race([aiPromise, timeoutPromise]) as any;

      const text = result.text;
      if (!text) throw new Error('AI 未返回有效结果');
      
      const fruitData = JSON.parse(text);
      if (!fruitData.name || !fruitData.nutrition) throw new Error('数据格式不完整');
      
      res.json(fruitData);
    } catch (err: any) {
      console.error('Identification error:', err);
      if (err.message === 'TIMEOUT') {
        res.status(504).json({ error: '识别超时了 😅 请确保网络畅通，或换个角度再试一次。' });
      } else {
        res.status(500).json({ error: '未能认出这是什么水果 🤔 试试靠近一点，或者换个明亮的背景再拍一张？' });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
