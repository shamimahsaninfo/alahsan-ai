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

- AI chat streams through the server route `src/routes/api/chat.ts` (logic in `src/lib/ai/chat.server.ts`), which verifies the caller's bearer token and thread ownership before calling the AI Gateway — keeps the key server-side and blocks cross-user access.
- Chat threads/messages live in `threads`/`messages` tables with owner-only RLS; the browser reads/writes them directly — RLS is the access boundary.
