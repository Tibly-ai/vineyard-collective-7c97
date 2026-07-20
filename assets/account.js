import { jsx, jsxs } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { NeonPostgrestClient } from "@neondatabase/postgrest-js";
import { createAuthClient } from "@neondatabase/auth";
const BACKEND = window.TIBLY_BACKEND;
const auth = createAuthClient(BACKEND.authUrl);
function anonClient() {
  return new NeonPostgrestClient({
    dataApiUrl: BACKEND.dataApiUrl,
    options: { global: { headers: { Authorization: "Bearer " + BACKEND.anonToken } } }
  });
}
async function authClient() {
  const { token } = await fetch(BACKEND.authUrl + "/token", { credentials: "include" }).then(
    (r) => r.json()
  );
  return new NeonPostgrestClient({
    dataApiUrl: BACKEND.dataApiUrl,
    options: { global: { headers: { Authorization: "Bearer " + token } } }
  });
}
function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [signInError, setSignInError] = useState("");
  const [signInBusy, setSignInBusy] = useState(false);
  const [member, setMember] = useState(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [varietalDraft, setVarietalDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [perks, setPerks] = useState([]);
  const [perksLoading, setPerksLoading] = useState(true);
  const [perksError, setPerksError] = useState("");
  useEffect(() => {
    loadPerks();
    checkSession();
  }, []);
  async function loadPerks() {
    setPerksLoading(true);
    setPerksError("");
    try {
      const client = anonClient();
      const { data, error } = await client.from("wine_club_perks").select("id,title,description").order("sort_order", { ascending: true });
      if (error) throw error;
      setPerks(data || []);
    } catch (e) {
      setPerksError("This page isn't fully set up yet. Please check back soon.");
    } finally {
      setPerksLoading(false);
    }
  }
  async function checkSession() {
    setCheckingSession(true);
    try {
      const res = await fetch(BACKEND.authUrl + "/token", { credentials: "include" });
      const body = await res.json();
      if (body && body.token) {
        setSignedIn(true);
        await loadMember();
      } else {
        setSignedIn(false);
      }
    } catch {
      setSignedIn(false);
    } finally {
      setCheckingSession(false);
    }
  }
  async function loadMember() {
    setMemberLoading(true);
    setMemberError("");
    try {
      const client = await authClient();
      const { data, error } = await client.from("club_members").select("*").maybeSingle();
      if (error) throw error;
      if (data) {
        setMember(data);
        setVarietalDraft(data.favorite_varietal || "");
        setNameDraft(data.display_name || "");
      } else {
        const { data: created, error: insertErr } = await client.from("club_members").insert({}).select("*").single();
        if (insertErr) throw insertErr;
        setMember(created);
      }
    } catch (e) {
      setMemberError("We couldn't load your member details right now. Try refreshing in a moment.");
    } finally {
      setMemberLoading(false);
    }
  }
  async function handleSignIn(e) {
    e.preventDefault();
    setSignInError("");
    if (!email.trim()) {
      setSignInError("Enter the email you used to join the club.");
      return;
    }
    setSignInBusy(true);
    try {
      await auth.signIn.magicLink({ email: email.trim(), callbackURL: window.location.href });
      setLinkSent(true);
    } catch (e2) {
      setSignInError("We couldn't send that link. Double check the email and try again.");
    } finally {
      setSignInBusy(false);
    }
  }
  async function handleSignOut() {
    try {
      await auth.signOut();
    } catch {
    }
    setSignedIn(false);
    setMember(null);
    setLinkSent(false);
    setEmail("");
  }
  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const client = await authClient();
      const { data, error } = await client.from("club_members").update({ display_name: nameDraft.trim() || null, favorite_varietal: varietalDraft.trim() || null }).eq("visitor_id", member.visitor_id).select("*").single();
      if (error) throw error;
      setMember(data);
      setSaveMsg("Saved.");
    } catch (e2) {
      setSaveMsg("That didn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  const joinedDate = member ? new Date(member.member_since).toLocaleDateString() : "";
  return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-cream", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-3xl px-6 py-16", children: [
    /* @__PURE__ */ jsxs("header", { className: "mb-10 text-center", children: [
      /* @__PURE__ */ jsx("h1", { className: "font-display text-4xl text-ink", children: "Vineyard Collective" }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 text-ink/70", children: "Member sign in for the wine club" })
    ] }),
    checkingSession && /* @__PURE__ */ jsx("div", { className: "card p-6 text-center text-ink/70", children: "Checking your session\u2026" }),
    !checkingSession && !signedIn && /* @__PURE__ */ jsxs("div", { className: "card mx-auto max-w-md p-8", children: [
      /* @__PURE__ */ jsx("h2", { className: "font-display text-2xl text-ink", children: "Sign in" }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-ink/70", children: "Enter your email and we'll send a link to your inbox. No password needed." }),
      linkSent ? /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-md bg-brand-50 p-4 text-brand-700", children: "Check your inbox for a sign in link. Click it and you'll land right back here, signed in." }) : /* @__PURE__ */ jsxs("form", { onSubmit: handleSignIn, className: "mt-6 space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-ink", htmlFor: "member-email", children: "Email" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              id: "member-email",
              type: "email",
              value: email,
              onChange: (e) => setEmail(e.target.value),
              placeholder: "you@example.com",
              className: "mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-ink focus:border-brand-600 focus:outline-none"
            }
          )
        ] }),
        signInError && /* @__PURE__ */ jsx("p", { className: "text-sm text-red-600", children: signInError }),
        /* @__PURE__ */ jsx("button", { type: "submit", disabled: signInBusy, className: "btn w-full", children: signInBusy ? "Sending\u2026" : "Send my sign in link" })
      ] })
    ] }),
    !checkingSession && signedIn && /* @__PURE__ */ jsxs("div", { className: "space-y-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "card p-8", children: [
        memberLoading && /* @__PURE__ */ jsx("p", { className: "text-ink/70", children: "Loading your member area\u2026" }),
        memberError && /* @__PURE__ */ jsx("p", { className: "text-red-600", children: memberError }),
        !memberLoading && !memberError && member && /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsxs("h2", { className: "font-display text-2xl text-ink", children: [
              "Welcome",
              member.display_name ? `, ${member.display_name}` : " back"
            ] }),
            /* @__PURE__ */ jsx("button", { onClick: handleSignOut, className: "btn-secondary", children: "Sign out" })
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "mt-2 text-ink/70", children: [
            "Member since ",
            joinedDate,
            ". Glad to have you in the club."
          ] }),
          /* @__PURE__ */ jsxs("form", { onSubmit: handleSaveProfile, className: "mt-6 space-y-4 border-t border-ink/10 pt-6", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-ink", htmlFor: "display-name", children: "Name on your account" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  id: "display-name",
                  type: "text",
                  value: nameDraft,
                  onChange: (e) => setNameDraft(e.target.value),
                  placeholder: "How should we greet you?",
                  className: "mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-ink focus:border-brand-600 focus:outline-none"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-ink", htmlFor: "favorite-varietal", children: "Favorite varietal" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  id: "favorite-varietal",
                  type: "text",
                  value: varietalDraft,
                  onChange: (e) => setVarietalDraft(e.target.value),
                  placeholder: "Pinot Noir, Chardonnay, Zinfandel\u2026",
                  className: "mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-ink focus:border-brand-600 focus:outline-none"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("button", { type: "submit", disabled: saving, className: "btn", children: saving ? "Saving\u2026" : "Save" }),
              saveMsg && /* @__PURE__ */ jsx("span", { className: "text-sm text-ink/70", children: saveMsg })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card p-8", children: [
        /* @__PURE__ */ jsx("h3", { className: "font-display text-xl text-ink", children: "Your club perks" }),
        perksLoading && /* @__PURE__ */ jsx("p", { className: "mt-3 text-ink/70", children: "Loading perks\u2026" }),
        perksError && /* @__PURE__ */ jsx("p", { className: "mt-3 text-red-600", children: perksError }),
        !perksLoading && !perksError && perks.length === 0 && /* @__PURE__ */ jsx("p", { className: "mt-3 text-ink/70", children: "Perks aren't listed yet. Check back soon or ask us at the tasting room." }),
        !perksLoading && !perksError && perks.length > 0 && /* @__PURE__ */ jsx("ul", { className: "mt-4 space-y-4", children: perks.map((p) => /* @__PURE__ */ jsxs("li", { className: "border-l-2 border-brand-600 pl-4", children: [
          /* @__PURE__ */ jsx("p", { className: "font-medium text-ink", children: p.title }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-ink/70", children: p.description })
        ] }, p.id)) })
      ] })
    ] })
  ] }) });
}
createRoot(document.getElementById("tibly-app-root")).render(/* @__PURE__ */ jsx(App, {}));
