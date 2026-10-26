import Link from "next/link";
import { createAttachment, deleteAttachment } from "@/app/actions";
import { attachmentCategoryOptions } from "@/lib/attachment-categories";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import type { TFunction } from "@/lib/i18n";

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

type DailyRecordOption = {
  id: string;
  date: Date;
};

type InvoiceOption = {
  id: string;
  invoiceNo: string | null;
  monthCovered: string;
};

function fileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function relatedLabel(attachment: AttachmentRow, t: TFunction) {
  if (attachment.invoice) {
    return t("pd.attach.relatedInvoice", { ref: attachment.invoice.invoiceNo || attachment.invoice.monthCovered });
  }
  if (attachment.dailyRecord) {
    return t("pd.attach.relatedDaily", { date: formatDate(attachment.dailyRecord.date) });
  }
  return t("pd.attach.relatedProject");
}

export async function AttachmentsPanel({
  projectId,
  attachments,
  dailyRecords,
  invoices,
}: {
  projectId: string;
  attachments: AttachmentRow[];
  dailyRecords: DailyRecordOption[];
  invoices: InvoiceOption[];
}) {
  const t = await getT();
  const categoryOptions = attachmentCategoryOptions(attachments.map((attachment) => attachment.category));

  return (
    <div className="panel p-4">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase text-lab-burgundy">{t("pd.attach.documents")}</div>
          <h2 className="text-xl font-bold">{t("pd.attach.title")}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-bold text-muted">{t("pd.attach.filesCount", { count: attachments.length })}</div>
          <Link href={`/projects/${projectId}/attachments`} className="btn btn-small btn-edit">{t("pd.attach.openViewer")}</Link>
        </div>
      </div>

      <form action={createAttachment} className="grid gap-3 rounded-lg border border-[#d7e1e5] bg-[#f1f3f5] p-4 lg:grid-cols-2">
        <input type="hidden" name="projectId" value={projectId} />
        <label>
          {t("pd.attach.file")}
          <input name="file" type="file" required />
        </label>
        <label>
          {t("pd.attach.category")}
          <select name="category" defaultValue="Drawings">
            {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label>
          {t("pd.attach.linkDaily")}
          <select name="dailyRecordId" defaultValue="">
            <option value="">{t("pd.attach.noDaily")}</option>
            {dailyRecords.map((record) => (
              <option key={record.id} value={record.id}>{formatDate(record.date)}</option>
            ))}
          </select>
        </label>
        <label>
          {t("pd.attach.linkInvoice")}
          <select name="invoiceId" defaultValue="">
            <option value="">{t("pd.attach.noInvoice")}</option>
            {invoices.map((invoice) => (
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

      <div className="mt-4 grid gap-3">
        {attachments.map((attachment) => (
          <div key={attachment.id} className="rounded-lg border border-[#d7e1e5] bg-white p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="status status-finished">{attachment.category}</span>
                  <span className="text-xs font-bold text-muted">{relatedLabel(attachment, t)}</span>
                </div>
                <div className="mt-2 truncate font-bold text-ink">{attachment.fileName}</div>
                <div className="mt-1 text-sm font-semibold text-muted">
                  {fileSize(attachment.size)} / {formatDate(attachment.createdAt)}
                </div>
                {attachment.label ? <div className="mt-2 text-sm text-ink">{attachment.label}</div> : null}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Link href={`/projects/${projectId}/attachments?category=${encodeURIComponent(attachment.category)}&file=${attachment.id}`} className="btn btn-small btn-edit">{t("pd.attach.view")}</Link>
                <Link href={`/api/attachments/${attachment.id}?download=1`} className="btn btn-small btn-save">{t("pd.attach.download")}</Link>
                <form action={deleteAttachment}>
                  <input type="hidden" name="id" value={attachment.id} />
                  <input type="hidden" name="projectId" value={projectId} />
                  <button className="btn btn-small btn-delete" type="submit">{t("common.delete")}</button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {!attachments.length ? (
          <div className="rounded-lg border border-dashed border-[#bdc8d0] bg-[#f1f3f5] p-4 text-sm font-bold text-muted">
            {t("pd.attach.emptyNone")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
