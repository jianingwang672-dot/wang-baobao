import { useEffect, useRef, type ReactNode } from "react";
import { Camera, ArrowUpRight, Sprout, X } from "lucide-react";
import Gecko from "./Gecko";
import { asset } from "../lib/data";
import type { Photo } from "../lib/schema";
export function Empty({
  title,
  children,
  icon = "camera",
}: {
  title: string;
  children: ReactNode;
  icon?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        {icon === "camera" ? <Camera size={25} /> : <Sprout size={25} />}
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>
          {title}
          <span className="title-dot">.</span>
        </h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function LinkButton({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <a className="text-link" href={`#${to}`}>
      {children}
      <ArrowUpRight size={16} />
    </a>
  );
}
export function PhotoImage({
  photo,
  thumbnail = false,
}: {
  photo: Photo;
  thumbnail?: boolean;
}) {
  return (
    <img
      src={asset(thumbnail ? photo.thumbnail : photo.src)}
      alt={`${photo.title}，${photo.date}拍摄的王豹豹`}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = "none";
        const parent = e.currentTarget.parentElement;
        if (parent && !parent.querySelector(".image-error")) {
          const el = document.createElement("span");
          el.className = "image-error";
          el.textContent = "照片暂时无法加载";
          parent.append(el);
        }
      }}
    />
  );
}
export function PhotoPlaceholder({ large = false }: { large?: boolean }) {
  return (
    <div className={`photo-placeholder ${large ? "large" : ""}`}>
      <Gecko />
      <span>王豹豹的照片，留在这里</span>
      <small>插画占位 · 等待第一张真实照片</small>
    </div>
  );
}
export function Modal({
  label,
  children,
  onClose,
}: {
  label: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d.close();
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={label}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <button
          autoFocus
          className="icon-button close"
          onClick={onClose}
          aria-label="关闭弹窗"
        >
          <X />
        </button>
        {children}
      </div>
    </dialog>
  );
}
