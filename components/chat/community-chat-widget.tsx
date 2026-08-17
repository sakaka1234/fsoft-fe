"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { Hammer } from "@phosphor-icons/react/dist/ssr/Hammer";
import { EASE_OUT } from "@/lib/motion";

export function CommunityChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label="Mở chat cộng đồng"
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-card transition-colors hover:bg-accent-hover focus:outline-none"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={26} weight="bold" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative flex items-center justify-center"
            >
              <ChatCircleDots size={28} weight="fill" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Under Development Popup Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="fixed bottom-24 right-6 z-50 flex h-[360px] w-[340px] max-w-[calc(100vw-2rem)] flex-col rounded-card border border-line bg-paper/95 shadow-card backdrop-blur-lg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-surface/60">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <ChatCircleDots size={22} weight="fill" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink tracking-tight">
                    Chat Cộng Đồng
                  </h3>
                  <span className="text-[0.7rem] font-medium text-amber-600 dark:text-amber-400">
                    Sắp ra mắt
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4">
                <Hammer size={32} weight="fill" />
              </div>
              <h4 className="text-base font-bold text-ink">
                Tính năng đang phát triển
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Hệ thống Chat Cộng Đồng đang được cập nhật và sẽ sớm ra mắt trong các phiên bản tiếp theo!
              </p>
              <span className="mt-4 rounded-full bg-amber-500/15 border border-amber-500/30 px-3.5 py-1 text-[0.75rem] font-bold text-amber-600 dark:text-amber-400">
                🚧 Đang phát triển
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
