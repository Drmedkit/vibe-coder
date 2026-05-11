# Vibe Coder rebuild goals

## Product goal

Vibe Coder is a Dutch classroom tool for students aged 10-16 who want to build webpages and small games without needing to code from scratch. The app should feel like a real creative coding workspace: AI helps students plan, build, and understand their project, while the student stays in control of what gets applied.

## MVP scope

- Keep the current student-first editor experience: AI panel, HTML/CSS/JS editor tabs, live preview, project library, import/export, and image assets.
- Add simple username/password accounts with no email and no private personal data.
- Gate registration with the single class code `h20`.
- Keep manual save. Browser drafts can persist locally, but the database should only change when students click save.
- Scope projects and generated assets to the signed-in student.
- Keep the interface in Dutch and avoid childish language.
- Preserve the dark H20 workspace direction while aligning colors, typography, and textures with the H20 brand guide.

## AI behavior

The visible UI has one smart chat, not three equal mode buttons. Internally the AI routes each message to an intent:

- `director`: shapes the student's idea through questions and suggestions. It never changes code.
- `first_build`: creates the first serious working version after enough intent exists. It outputs full HTML/CSS/JS.
- `inspect`: explains what the project does, what is strong or weak, and what to improve next. It never changes code.
- `adjust`: makes small changes, preferably with patches.
- `major_rebuild`: handles meaningful direction changes after preserve/replace context is clear.

The first build is locked until the student has a raw idea, core experience, at least two must-haves, one style direction, and one confirmed choice. AI output should use a strict JSON contract internally. Director and inspect responses must be rejected if they include code operations.

## H20 branding

- Use H20 red `#DD084B` as the primary brand accent.
- Use education yellow `#F9CD00` for selected educational highlights and primary confirmation moments.
- Use dark UI surfaces from the brand guide: `#0d0d0d`, `#111111`, and `#161616` with subtle white dividers.
- Use the H20 square pattern as texture, not as decoration overload.
- Use Barlow Condensed for H20-style headings and a clean sans-serif for body/UI text.
- Avoid color-on-color combinations. Use white or black text on brand colors.

## Security posture

This is not intended as high-security identity. The goal is to reduce random token usage while staying easy for students.

- Registration code is `h20`.
- Students use a username and password.
- If a student loses the password, there is no recovery flow in the app.
- Passwords must still be hashed and sessions must still be httpOnly cookies.

## Non-goals for this rebuild

- No teacher dashboard yet.
- No email, password reset, OAuth, or personal profile fields.
- No public gallery, likes, published projects, or community moderation.
- No assignment/grade workflow.
