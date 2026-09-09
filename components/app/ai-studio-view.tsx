"use client";

import { Container } from "@/components/ui/container";
import { UserAgentPanel } from "@/components/app/user-agent-view";

/*
  The /ai page is now the Agent User home: the student-facing AI tutor chat.
  The other tool panels (auto deck, story, situation, roleplay) moved behind
  the admin console's AI section, so this view is a thin host for the chat.
*/

export function AiStudioView() {
  return (
    <Container className="flex flex-col gap-8 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Agent User</h1>
        <p className="max-w-prose text-muted">
          Gia sư AI: hỏi đáp bất cứ điều gì, AI có thể tự tạo bộ thẻ hoặc thêm
          từ vựng vào bộ thẻ của bạn khi bạn yêu cầu.
        </p>
      </header>

      <UserAgentPanel />
    </Container>
  );
}