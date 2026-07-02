import Link from "next/link";
import { notFound } from "next/navigation";
import { createAttachment, deleteAttachment } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { attachmentCategoryOptions } from "@/lib/attachment-categories";
import { prisma } from "@/lib/prisma";

type AttachmentRow = {
  id: string;
  category: string;
  label: string | null;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: Date;
  dailyRecord: { date: Date } | null;
  invoice: { invoiceNo: string | null; monthCovered: string } | null;
};

function fileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function relatedLabel(attachment: AttachmentRow) {
  if (attachment.invoice) return `Invoice ${attachment.invoice.invoiceNo || attachment.invoice.monthCovered}`;
  if (attachment.dailyRecord) return `Daily record ${attachment.dailyRecord.date.toLocaleDateString()}`;
  return "Project file";
}

function canPreview(contentType: string) {
  return contentType.startsWith("image/") || contentType === "application/pdf" || contentType.startsWith("text/");
}

function categoryHref(projectId: string, category: string) {
  return `/projects/${projectId}/attachments?category=${encodeURIComponent(category)}`;
}

function fileHref(projectId: string, category: string, fileId: string) {
  return `/projects/${projectId}/attachments?category=${encodeURIComponent(category)}&file=${fileId}`;
}

export default async function ProjectAttachmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string; file?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      attachments: {
        select: {
          id: true,
          category: true,
          label: true,
          fileName: true,
          contentType: true,
          size: true,
          createdAt: true,
          dailyRecord: { select: { date: true } },
          invoice: { select: { invoiceNo: true, monthCovered: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      dailyRecords: { select: { id: true, date: true }, orderBy: { date: "desc" } },
      invoices: { select: { id: true, invoiceNo: true, monthCovered: true }, orderBy: { invoiceDate: "desc" } },
    },
  });

  if (!project) notFound();

  const existingCategories = Array.from(new Set(project.attachments.map((attachment) => attachment.category))).sort((a, b) => a.localeCompare(b));
  const uploadCategories = attachmentCategoryOptions(existingCategories);
  const selectedCategory = query.category && uploadCategories.includes(query.category) ? query.category : uploadCategories[0];
  const categoryFiles = project.attachments.filter((attachment) => attachment.category === selectedCategory);
  const selectedAttachment = categoryFiles.find((attachment) => attachment.id === query.file) || categoryFiles[0] || null;

  return (
    <>
      <PageTitle eyebrow={project.clientName || "Project documents"} title={`${project.name} attachments`}>
        <Link href={`/projects/${project.id}`} className="btn btn-secondary">Back to project</Link>
      </PageTitle>

      <section className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="panel p-4">
          <div className="mb-3">
            <div className="text-xs font-black uppercase text-[#5b193f]">Categories</div>
            <h2 className="mt-1 text-lg font-black">Documents</h2>
          </div>
          <div className="grid gap-2">
            {uploadCategories.map((category) => {
              const count = project.attachments.filter((attachment) => attachment.category === category).length;
              const active = category === selectedCategory;
              return (
                <Link
                  key={category}
                  href={categoryHref(project.id, category)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-black transition ${active ? "border-[#5b193f] bg-[#f4e8eb] text-[#5b193f]" : "border-[#d7e1e5] bg-white text-[#373455] hover:border-[#777da7]"}`}
                >
                  <span>{category}</span>
                  <span className="text-xs text-[#6b7188]">{count}</span>
                </Link>
              );
            })}
          </div>
        </aside>

        <div className="grid gap-5">
          <div className="panel p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase text-[#5b193f]">{selectedCategory}</div>
                <h2 className="text-xl font-black">{selectedAttachment ? selectedAttachment.fileName : "No document selected"}</h2>
                {selectedAttachment ? (
                  <div className="mt-1 text-sm font-semibold text-[#6b7188]">
                    {relatedLabel(selectedAttachment)} / {fileSize(selectedAttachment.size)} / {selectedAttachment.createdAt.toLocaleDateString()}
                  </div>
                ) : null}
              </div>
              {selectedAttachment ? (
                <div className="flex flex-wrap gap-2">
                  <Link href={`/api/attachments/${selectedAttachment.id}?download=1`} className="btn btn-small btn-save">Download</Link>
                  <form action={deleteAttachment}>
                    <input type="hidden" name="id" value={selectedAttachment.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <button className="btn btn-small btn-delete" type="submit">Delete</button>
                  </form>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="grid content-start gap-2">
                {categoryFiles.map((attachment) => {
                  const active = attachment.id === selectedAttachment?.id;
                  return (
                    <Link
                      key={attachment.id}
                      href={fileHref(project.id, selectedCategory, attachment.id)}
                      className={`rounded-lg border p-3 transition ${active ? "border-[#5b193f] bg-[#fff8fa]" : "border-[#d7e1e5] bg-white hover:border-[#777da7]"}`}
                    >
                      <div className="truncate text-sm font-black text-[#373455]">{attachment.fileName}</div>
                      <div className="mt-1 text-xs font-bold text-[#6b7188]">{relatedLabel(attachment)}</div>
                      {attachment.label ? <div className="mt-2 line-clamp-2 text-xs font-semibold text-[#6b7188]">{attachment.label}</div> : null}
                    </Link>
                  );
                })}
                {!categoryFiles.length ? (
                  <div className="rounded-lg border border-dashed border-[#bdc8d0] bg-[#f3f7f3] p-4 text-sm font-bold text-[#6b7188]">
                    No files in this category yet.
                  </div>
                ) : null}
              </div>

              <div className="min-h-[620px] overflow-hidden rounded-lg border border-[#d7e1e5] bg-[#f7fbfa]">
                {selectedAttachment && canPreview(selectedAttachment.contentType) ? (
                  <iframe
                    title={selectedAttachment.fileName}
                    src={`/api/attachments/${selectedAttachment.id}`}
                    className="h-[620px] w-full bg-white"
                  />
                ) : selectedAttachment ? (
                  <div className="grid h-[620px] place-items-center p-8 text-center">
                    <div>
                      <div className="text-xl font-black text-[#373455]">Preview is not available for this file type.</div>
                      <p className="mt-2 text-sm font-semibold text-[#6b7188]">Download the file to open it on your computer.</p>
                      <Link href={`/api/attachments/${selectedAttachment.id}?download=1`} className="btn btn-primary mt-4">Download document</Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid h-[620px] place-items-center p-8 text-center text-sm font-bold text-[#6b7188]">
                    Select a category and document to preview it here.
                  </div>
                )}
              </div>
            </div>
          </div>

          <form action={createAttachment} className="panel grid gap-3 p-4 lg:grid-cols-2">
            <input type="hidden" name="projectId" value={project.id} />
            <label>
              File
              <input name="file" type="file" required />
            </label>
            <label>
              Category
              <select name="category" defaultValue={selectedCategory}>
                {uploadCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Link to daily record
              <select name="dailyRecordId" defaultValue="">
                <option value="">No daily record</option>
                {project.dailyRecords.map((record) => (
                  <option key={record.id} value={record.id}>{record.date.toLocaleDateString()}</option>
                ))}
              </select>
            </label>
            <label>
              Link to invoice
              <select name="invoiceId" defaultValue="">
                <option value="">No invoice</option>
                {project.invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>{invoice.invoiceNo || "Invoice"} / {invoice.monthCovered}</option>
                ))}
              </select>
            </label>
            <label className="lg:col-span-2">
              Note
              <input name="label" placeholder="Drawing revision, contract note, invoice reference, receipt details" />
            </label>
            <div className="flex items-center justify-between gap-3 lg:col-span-2">
              <div className="text-xs font-bold text-[#6b7188]">Maximum upload size: 8 MB per file.</div>
              <button className="btn btn-small btn-save" type="submit">Upload file</button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
