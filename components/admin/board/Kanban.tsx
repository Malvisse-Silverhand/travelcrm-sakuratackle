"use client";

import { useState, type ReactNode } from "react";
import Icon from "@/components/public/book/Icon";
import styles from "./board.module.css";

export type KanbanColumn<T> = {
  key: string;
  label: string;
  icon: string;
  /** Accent for the column's top bar. */
  tone: "purple" | "gold" | "green" | "lamp" | "teal" | "red" | "grey";
  items: T[];
  /** Shown under the title, e.g. "RM 4,500". */
  sub?: string;
  /** Whether a dragged item may be dropped here. Omit for no drops. */
  accepts?: (item: T) => boolean;
  onDrop?: (item: T) => void;
  empty?: string;
};

type Props<T> = {
  columns: KanbanColumn<T>[];
  itemKey: (item: T) => string;
  renderCard: (item: T, column: string) => ReactNode;
};

/** A board of columns with native drag and drop. While dragging, columns
 *  that would refuse the card dim; on touch screens the cards' own buttons
 *  do the same moves. */
export default function Kanban<T>({ columns, itemKey, renderCard }: Props<T>) {
  const [dragging, setDragging] = useState<{ item: T; from: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const can = (col: KanbanColumn<T>) =>
    !!dragging && col.key !== dragging.from && !!col.accepts && !!col.onDrop && col.accepts(dragging.item);

  return (
    <div className={styles.board} role="list">
      {columns.map((col) => {
        const allowed = can(col);
        return (
          <section
            key={col.key}
            role="listitem"
            aria-label={col.label}
            className={[
              styles.col,
              styles[`tone_${col.tone}`],
              dragging && !allowed && col.key !== dragging.from ? styles.colDim : "",
              allowed ? styles.colCan : "",
              over === col.key && allowed ? styles.colOver : "",
            ].join(" ")}
            onDragOver={(e) => {
              if (!allowed) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== col.key) setOver(col.key);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const d = dragging;
              setOver(null);
              setDragging(null);
              if (d && allowed) col.onDrop?.(d.item);
            }}
          >
            <header className={styles.colHead}>
              <span className={styles.colIcon}>
                <Icon name={col.icon} size={18} />
              </span>
              <span className={styles.colTitle}>
                <b>{col.label}</b>
                {col.sub && <small>{col.sub}</small>}
              </span>
              <span className={styles.colCount}>{col.items.length}</span>
            </header>
            <div className={styles.colBody}>
              {col.items.length === 0 ? (
                <p className={styles.colEmpty}>{allowed ? "Drop here" : col.empty ?? "Nothing here"}</p>
              ) : (
                col.items.map((item) => (
                  <div
                    key={itemKey(item)}
                    className={styles.cardWrap}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", itemKey(item));
                      setDragging({ item, from: col.key });
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                  >
                    {renderCard(item, col.key)}
                  </div>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
