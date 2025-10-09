// app/api/line/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Client } from "@line/bot-sdk";

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
};

const client = new Client({ channelAccessToken: lineConfig.channelAccessToken });

// verify signature helper
function verifySignature(body: string, signature: string | null) {
  if (!signature) return false;
  const hash = crypto.createHmac("sha256", lineConfig.channelSecret).update(body).digest("base64");
  return hash === signature;
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifySignature(bodyText, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // handle each event (message, follow, postback, etc.)
  const events = body.events || [];
  await Promise.all(events.map(handleEvent));

  return NextResponse.json({ status: "ok" });
}

async function handleEvent(event: any) {
  try {
    if (event.type === "message" && event.message.type === "text") {
      const userText: string = event.message.text;

      // ตัวอย่าง: ถามข้อมูลจากเว็บแอปของคุณ (เชื่อม API ภายใน)
      // สมมติเว็บแอปมี endpoint /api/shared-data?key=...
      const sharedApiUrl = `${process.env.INTERNAL_API_BASE}/api/shared-data?query=${encodeURIComponent(userText)}`;
      // ถ้าเว็บและ webhook อยู่ในโปรเจคเดียวกัน สามารถเรียก relative path หรือเรียกฟังก์ชันภายในแทนได้
      const resp = await fetch(sharedApiUrl);
      const info = resp.ok ? await resp.json() : { text: "ขออภัย ไม่พบข้อมูล" };

      // ตอบกลับผู้ใช้
      const replyText = info.text || `รับข้อความ: ${userText}`;
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: replyText,
      });
    } else if (event.type === "follow") {
      // user added your bot -> welcome
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "สวัสดี! ยินดีต้อนรับครับ/ค่ะ 😊",
      });
    } else if (event.type === "postback") {
      // handle postback
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `คุณกด: ${JSON.stringify(event.postback)}`,
      });
    }
    // เพิ่ม event อื่น ๆ ตามต้องการ
  } catch (err) {
    console.error("handleEvent error:", err);
  }
}
