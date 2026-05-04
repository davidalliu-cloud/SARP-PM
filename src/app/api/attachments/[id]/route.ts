import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function safeFileName(name: string) {
  return name.replaceAll(/[\r\n"]/g, "_");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });

  if (!attachment) {
    return new Response("Attachment not found", { status: 404 });
  }

  return new Response(attachment.data, {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Length": String(attachment.size),
      "Content-Disposition": `attachment; filename="${safeFileName(attachment.fileName)}"`,
    },
  });
}
