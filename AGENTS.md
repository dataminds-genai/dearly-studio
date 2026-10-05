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

- Artist transformations use a server route when available and a client-side canvas fallback; credentials never enter browser code.
- Preview and downloadable output share normalized composition settings for ratio, pan, zoom, rotation, and typography.
- The quick creator is the `/` first screen; `/create` remains an equivalent entry point so existing links keep working.
