<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI chat streams through the server route `src/routes/api/chat.ts` (code copied from the owner's alahsanbd ZIP), which verifies the caller's bearer token and conversation ownership before calling the AI Gateway — keeps the key server-side and blocks cross-user access.
- Chats live in `conversations`/`messages` (`threads` is legacy, kept for old data) with owner-only RLS; the browser reads/writes them directly — RLS is the access boundary.
- Clock, live-evidence rules and RSS freshness parsing live in `src/lib/chat-grounding.ts` so factual behavior is independently testable.
- Voice calls stay mounted inside the chat and receive bounded recent turns through the authenticated token function; closing or changing chats releases the microphone.
