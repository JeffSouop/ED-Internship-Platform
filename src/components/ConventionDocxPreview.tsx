import { renderAsync } from "docx-preview";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ZOOM_MIN = 0.45;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 0.72;

type ConventionDocxPreviewProps = {
  studentId: string;
  refreshKey: number;
  className?: string;
  layout?: "default" | "sidebar";
};

function collectDocxPages(container: HTMLElement): HTMLElement[] {
  const wrapper = container.querySelector(".docx-wrapper");
  if (!wrapper) return [];

  const blocks = Array.from(wrapper.children).filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && node.tagName !== "STYLE",
  );
  if (blocks.length > 1) return blocks;

  const sections = wrapper.querySelectorAll("section.docx, section[class*='docx']");
  if (sections.length > 0) return Array.from(sections) as HTMLElement[];

  return blocks.length > 0 ? blocks : [];
}

export function ConventionDocxPreview({
  studentId,
  refreshKey,
  className,
  layout = "default",
}: ConventionDocxPreviewProps) {
  const sidebar = layout === "sidebar";
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLElement[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);

  const applyPageVisibility = useCallback((index: number) => {
    pagesRef.current.forEach((page, i) => {
      page.style.display = i === index ? "block" : "none";
      page.style.marginLeft = "auto";
      page.style.marginRight = "auto";
    });
  }, []);

  const fitZoomToViewport = useCallback(() => {
    const page = pagesRef.current[pageIndex];
    const viewport = viewportRef.current;
    if (!page || !viewport) return;
    const pageWidth = page.getBoundingClientRect().width || page.offsetWidth;
    if (pageWidth <= 0) return;
    const available = viewport.clientWidth - 24;
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, available / pageWidth));
    setZoom(Number(next.toFixed(2)));
  }, [pageIndex]);

  useEffect(() => {
    setPageIndex(0);
    setZoom(ZOOM_DEFAULT);
    pagesRef.current = [];
    setPageCount(0);
  }, [studentId, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPageIndex(0);
      pagesRef.current = [];
      setPageCount(0);
      if (bodyRef.current) bodyRef.current.innerHTML = "";
      if (styleRef.current) styleRef.current.innerHTML = "";

      try {
        const res = await apiFetch(
          `/api/admin/conventions/preview/${encodeURIComponent(studentId)}`,
        );
        if (!res.ok) {
          let message = res.statusText;
          try {
            const body = (await res.json()) as { error?: string };
            if (body.error) message = body.error;
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }
        const blob = await res.blob();
        if (cancelled || !bodyRef.current || !styleRef.current) return;

        await renderAsync(blob, bodyRef.current, styleRef.current, {
          className: "docx-convention",
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          renderHeaders: true,
          renderFooters: true,
        });

        if (cancelled || !bodyRef.current) return;
        let pages = collectDocxPages(bodyRef.current);
        if (pages.length === 0 && bodyRef.current) {
          pages = [bodyRef.current];
        }
        pagesRef.current = pages;
        const count = pages.length;
        setPageCount(count);
        applyPageVisibility(0);
        requestAnimationFrame(() => {
          if (!cancelled) fitZoomToViewport();
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Impossible d’afficher la convention.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [studentId, refreshKey, sidebar, applyPageVisibility, fitZoomToViewport]);

  useEffect(() => {
    if (loading || pageCount === 0) return;
    applyPageVisibility(pageIndex);
    requestAnimationFrame(() => fitZoomToViewport());
  }, [pageIndex, pageCount, loading, applyPageVisibility, fitZoomToViewport]);

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;
  const displayPage = pageCount > 0 ? pageIndex + 1 : 0;

  function changeZoom(delta: number) {
    setZoom((z) => Number(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)).toFixed(2)));
  }

  return (
    <div className={cn("relative flex min-h-0 flex-col", sidebar && "flex-1", className)}>
      <div ref={styleRef} className="sr-only" aria-hidden />

      {!loading && !error && pageCount > 0 && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-2 py-1.5">
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!canPrev}
              aria-label="Page précédente"
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[5.5rem] text-center text-xs font-medium tabular-nums text-foreground">
              Page {displayPage} / {pageCount}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!canNext}
              aria-label="Page suivante"
              onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={zoom <= ZOOM_MIN}
              aria-label="Dézoomer"
              onClick={() => changeZoom(-ZOOM_STEP)}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="min-w-[3rem] text-center text-xs font-medium tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)} %
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={zoom >= ZOOM_MAX}
              aria-label="Zoomer"
              onClick={() => changeZoom(ZOOM_STEP)}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 h-8 text-xs"
              onClick={fitZoomToViewport}
            >
              Ajuster
            </Button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement de l&apos;aperçu…
        </div>
      )}

      {error && !loading && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div
        ref={viewportRef}
        className={cn(
          "min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-muted/20",
          sidebar ? "basis-0" : "max-h-[min(70vh,52rem)]",
          (loading || error) && "hidden",
        )}
      >
        <div
          className="flex min-h-full justify-center py-4"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
          }}
        >
          <div
            ref={bodyRef}
            className={cn(
              "docx-convention-preview w-max max-w-none",
              "[&_.docx-wrapper]:!mx-auto [&_.docx-wrapper]:bg-white [&_.docx-wrapper]:shadow-md",
              "[&_section.docx]:box-border",
              "[&_table]:max-w-full",
              "[&_img]:max-w-full [&_img]:h-auto",
            )}
          />
        </div>
      </div>
    </div>
  );
}
