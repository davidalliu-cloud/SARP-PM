import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

function safeFileName(name: string) {
  return name.replaceAll(/[\r\n"]/g, "_");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });

  if (!attachment) {
    return new Response("Attachment not found", { status: 404 });
  }

  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

  return new Response(attachment.data, {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Length": String(attachment.size),
      "Content-Disposition": `${disposition}; filename="${safeFileName(attachment.fileName)}"`,
    },
  });
}
