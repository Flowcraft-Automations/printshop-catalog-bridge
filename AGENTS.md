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

QA Master: no agent (Lovable included) may delete or change anything under `qa-master/` or the file `.github/workflows/qa-master.yml`; QA Master installs and regenerates them, and a change to them is made by a person, in a pull request.
