"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Minus } from "@phosphor-icons/react/Minus";
import { Plus } from "@phosphor-icons/react/Plus";

import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { faq } from "@/content/landing";
import { EASE_OUT } from "@/lib/motion";

export function Faq() {
  const [open, setOpen] = useState<string | null>(faq.items[0].question);
  const reduce = useReducedMotion();

  return (
    <Section id="faq" tone="tinted" aria-labelledby="faq-title">
      <Container>
        <SectionHeading id="faq-title" title={faq.title} />

        <ul className="mt-12">
          {faq.items.map((item, index) => {
            const isOpen = open === item.question;
            const panelId = `faq-panel-${index}`;

            return (
              <li key={item.question} className="border-t border-line last:border-b">
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : item.question)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left"
                  >
                    <span className="text-lg font-medium md:text-xl">
                      {item.question}
                    </span>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-accent-text">
                      {isOpen ? <Minus size={15} /> : <Plus size={15} />}
                    </span>
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      id={panelId}
                      key="panel"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-[68ch] pb-7 text-base leading-relaxed text-muted">
                        {item.answer}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
