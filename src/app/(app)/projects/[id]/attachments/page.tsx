import Link from "next/link";
import { notFound } from "next/navigation";
import { createAttachment, deleteAttachment } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { attachmentCategoryOptions } from "@/lib/attachment-categories";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import type { TFunction } from "@/lib/i18n";
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

function relatedLabel(attachment: AttachmentRow, t: TFunction) {
  if (attachment.invoice) return t("pd.attach.relatedInvoice", { ref: attachment.invoice.invoiceNo || attachment.invoice.monthCovered });
  if (attachment.dailyRecord) return t("pd.attach.relatedDaily", { date: formatDate(attachment.dailyRecord.date) });
  return t("pd.attach.relatedProject");
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
  const t = await getT();
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
      <PageTitle eyebrow={project.clientName || t("pd.attach.pageEyebrow")} title={t("pd.attach.pageTitle", { name: project.name })}>
        <Link href={`/projects/${project.id}`} className="btn btn-secondary">{t("pd.attach.backToProject")}</Link>
      </PageTitle>

      <section className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="panel p-4">
          <div className="mb-3">
            <div className="text-xs font-bold uppercase text-lab-burgundy">{t("pd.attach.categories")}</div>
            <h2 className="mt-1 text-lg font-bold">{t("pd.attach.documents")}</h2>
          </div>
          <div className="grid gap-2">
            {uploadCategories.map((category) => {
              const count = project.attachments.filter((attachment) => attachment.category === category).length;
              const active = category === selectedCategory;
              return (
                <Link
                  key={category}
                  href={categoryHref(project.id, category)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-bold transition ${active ? "border-lab-burgundy bg-[#f4e8eb] text-lab-burgundy" : "border-[#d7e1e5] bg-white text-ink hover:border-[#777da7]"}`}
                >
                  <span>{category}</span>
                  <span className="text-xs text-muted">{count}</span>
                </Link>
              );
            })}
          </div>
        </aside>

        <div className="grid gap-5">
          <div className="panel p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-lab-burgundy">{selectedCategory}</div>
                <h2 className="text-xl font-bold">{selectedAttachment ? selectedAttachment.fileName : t("pd.attach.noDocSelected")}</h2>
                {selectedAttachment ? (
                  <div className="mt-1 text-sm font-semibold text-muted">
                    {relatedLabel(selectedAttachment, t)} / {fileSize(selectedAttachment.size)} / {formatDate(selectedAttachment.createdAt)}
                  </div>
                ) : null}
              </div>
              {selectedAttachment ? (
                <div className="flex flex-wrap gap-2">
                  <Link href={`/api/attachments/${selectedAttachment.id}?download=1`} className="btn btn-small btn-save">{t("pd.attach.download")}</Link>
                  <form action={deleteAttachment}>
                    <input type="hidden" name="id" value={selectedAttachment.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <button className="btn btn-small btn-delete" type="submit">{t("common.delete")}</button>
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
                      className={`rounded-lg border p-3 transition ${active ? "border-lab-burgundy bg-[#fff8fa]" : "border-[#d7e1e5] bg-white hover:border-[#777da7]"}`}
                    >
                      <div className="truncate text-sm font-bold text-ink">{attachment.fileName}</div>
                      <div className="mt-1 text-xs font-bold text-muted">{relatedLabel(attachment, t)}</div>
                      {attachment.label ? <div className="mt-2 line-clamp-2 text-xs font-semibold text-muted">{attachment.label}</div> : null}
                    </Link>
                  );
                })}
                {!categoryFiles.length ? (
                  <div className="rounded-lg border border-dashed border-[#bdc8d0] bg-[#f1f3f5] p-4 text-sm font-bold text-muted">
                    {t("pd.attach.noFilesInCategory")}
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
                      <div className="text-xl font-bold text-ink">{t("pd.attach.previewUnavailable")}</div>
                      <p className="mt-2 text-sm font-semibold text-muted">{t("pd.attach.previewUnavailableHint")}</p>
                      <Link href={`/api/attachments/${selectedAttachment.id}?download=1`} className="btn btn-primary mt-4">{t("pd.attach.downloadDocument")}</Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid h-[620px] place-items-center p-8 text-center text-sm font-bold text-muted">
                    {t("pd.attach.selectToPreview")}
                  </div>
                )}
              </div>
            </div>
          </div>

          <form action={createAttachment} className="panel grid gap-3 p-4 lg:grid-cols-2">
            <input type="hidden" name="projectId" value={project.id} />
            <label>
              {t("pd.attach.file")}
              <input name="file" type="file" required />
            </label>
            <label>
              {t("pd.attach.category")}
              <select name="category" defaultValue={selectedCategory}>
                {uploadCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              {t("pd.attach.linkDaily")}
              <select name="dailyRecordId" defaultValue="">
                <option value="">{t("pd.attach.noDaily")}</option>
                {project.dailyRecords.map((record) => (
                  <option key={record.id} value={record.id}>{formatDate(record.date)}</option>
                ))}
              </select>
            </label>
            <label>
              {t("pd.attach.linkInvoice")}
              <select name="invoiceId" defaultValue="">
                <option value="">{t("pd.attach.noInvoice")}</option>
                {project.invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>{invoice.invoiceNo || t("pd.attach.invoiceFallback")} / {invoice.monthCovered}</option>
                ))}
              </select>
            </label>
            <label className="lg:col-span-2">
              {t("pd.attach.note")}
              <input name="label" placeholder={t("pd.attach.notePlaceholder")} />
            </label>
            <div className="flex items-center justify-between gap-3 lg:col-span-2">
              <div className="text-xs font-bold text-muted">{t("pd.attach.maxSize")}</div>
              <button className="btn btn-small btn-save" type="submit">{t("pd.attach.uploadFile")}</button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
