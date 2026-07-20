/* TIBLY:SQL
CREATE TABLE IF NOT EXISTS club_members (
  visitor_id text PRIMARY KEY DEFAULT auth.user_id(),
  email text,
  display_name text,
  favorite_varietal text,
  member_since timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wine_club_perks (
  id serial PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS wine_club_perks_sort_idx ON wine_club_perks (sort_order);

DO $$ BEGIN
  CREATE POLICY club_members_select_own ON club_members
    FOR SELECT TO authenticated
    USING (visitor_id = auth.user_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY club_members_insert_own ON club_members
    FOR INSERT TO authenticated
    WITH CHECK (visitor_id = auth.user_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY club_members_update_own ON club_members
    FOR UPDATE TO authenticated
    USING (visitor_id = auth.user_id())
    WITH CHECK (visitor_id = auth.user_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY wine_club_perks_select_anon ON wine_club_perks
    FOR SELECT TO anonymous
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY wine_club_perks_select_auth ON wine_club_perks
    FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE ON club_members TO anonymous, authenticated;
GRANT SELECT ON wine_club_perks TO anonymous, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anonymous, authenticated;
*/

import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { NeonPostgrestClient } from "@neondatabase/postgrest-js";
import { createAuthClient } from "@neondatabase/auth";

const BACKEND = (window as any).TIBLY_BACKEND;
const auth = createAuthClient(BACKEND.authUrl);

function anonClient() {
  return new NeonPostgrestClient({
    dataApiUrl: BACKEND.dataApiUrl,
    options: { global: { headers: { Authorization: "Bearer " + BACKEND.anonToken } } },
  });
}

async function authClient() {
  const { token } = await fetch(BACKEND.authUrl + "/token", { credentials: "include" }).then((r) =>
    r.json()
  );
  return new NeonPostgrestClient({
    dataApiUrl: BACKEND.dataApiUrl,
    options: { global: { headers: { Authorization: "Bearer " + token } } },
  });
}

type Perk = { id: number; title: string; description: string };
type Member = {
  visitor_id: string;
  email: string | null;
  display_name: string | null;
  favorite_varietal: string | null;
  member_since: string;
};

function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [signInError, setSignInError] = useState("");
  const [signInBusy, setSignInBusy] = useState(false);

  const [member, setMember] = useState<Member | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState("");

  const [varietalDraft, setVarietalDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [perks, setPerks] = useState<Perk[]>([]);
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
      const { data, error } = await client
        .from("wine_club_perks")
        .select("id,title,description")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setPerks((data as Perk[]) || []);
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
        setMember(data as Member);
        setVarietalDraft((data as Member).favorite_varietal || "");
        setNameDraft((data as Member).display_name || "");
      } else {
        const { data: created, error: insertErr } = await client
          .from("club_members")
          .insert({})
          .select("*")
          .single();
        if (insertErr) throw insertErr;
        setMember(created as Member);
      }
    } catch (e) {
      setMemberError("We couldn't load your member details right now. Try refreshing in a moment.");
    } finally {
      setMemberLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
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
    } catch (e) {
      setSignInError("We couldn't send that link. Double check the email and try again.");
    } finally {
      setSignInBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      await auth.signOut();
    } catch {}
    setSignedIn(false);
    setMember(null);
    setLinkSent(false);
    setEmail("");
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const client = await authClient();
      const { data, error } = await client
        .from("club_members")
        .update({ display_name: nameDraft.trim() || null, favorite_varietal: varietalDraft.trim() || null })
        .eq("visitor_id", member.visitor_id)
        .select("*")
        .single();
      if (error) throw error;
      setMember(data as Member);
      setSaveMsg("Saved.");
    } catch (e) {
      setSaveMsg("That didn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const joinedDate = member ? new Date(member.member_since).toLocaleDateString() : "";

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-10 text-center">
          <h1 className="font-display text-4xl text-ink">Vineyard Collective</h1>
          <p className="mt-2 text-ink/70">Member sign in for the wine club</p>
        </header>

        {checkingSession && (
          <div className="card p-6 text-center text-ink/70">Checking your session…</div>
        )}

        {!checkingSession && !signedIn && (
          <div className="card mx-auto max-w-md p-8">
            <h2 className="font-display text-2xl text-ink">Sign in</h2>
            <p className="mt-2 text-sm text-ink/70">
              Enter your email and we'll send a link to your inbox. No password needed.
            </p>
            {linkSent ? (
              <div className="mt-6 rounded-md bg-brand-50 p-4 text-brand-700">
                Check your inbox for a sign in link. Click it and you'll land right back here,
                signed in.
              </div>
            ) : (
              <form onSubmit={handleSignIn} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink" htmlFor="member-email">
                    Email
                  </label>
                  <input
                    id="member-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-ink focus:border-brand-600 focus:outline-none"
                  />
                </div>
                {signInError && <p className="text-sm text-red-600">{signInError}</p>}
                <button type="submit" disabled={signInBusy} className="btn w-full">
                  {signInBusy ? "Sending…" : "Send my sign in link"}
                </button>
              </form>
            )}
          </div>
        )}

        {!checkingSession && signedIn && (
          <div className="space-y-8">
            <div className="card p-8">
              {memberLoading && <p className="text-ink/70">Loading your member area…</p>}
              {memberError && <p className="text-red-600">{memberError}</p>}
              {!memberLoading && !memberError && member && (
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-2xl text-ink">
                      Welcome{member.display_name ? `, ${member.display_name}` : " back"}
                    </h2>
                    <button onClick={handleSignOut} className="btn-secondary">
                      Sign out
                    </button>
                  </div>
                  <p className="mt-2 text-ink/70">
                    Member since {joinedDate}. Glad to have you in the club.
                  </p>

                  <form onSubmit={handleSaveProfile} className="mt-6 space-y-4 border-t border-ink/10 pt-6">
                    <div>
                      <label className="block text-sm font-medium text-ink" htmlFor="display-name">
                        Name on your account
                      </label>
                      <input
                        id="display-name"
                        type="text"
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        placeholder="How should we greet you?"
                        className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-ink focus:border-brand-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink" htmlFor="favorite-varietal">
                        Favorite varietal
                      </label>
                      <input
                        id="favorite-varietal"
                        type="text"
                        value={varietalDraft}
                        onChange={(e) => setVarietalDraft(e.target.value)}
                        placeholder="Pinot Noir, Chardonnay, Zinfandel…"
                        className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2 text-ink focus:border-brand-600 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="submit" disabled={saving} className="btn">
                        {saving ? "Saving…" : "Save"}
                      </button>
                      {saveMsg && <span className="text-sm text-ink/70">{saveMsg}</span>}
                    </div>
                  </form>
                </div>
              )}
            </div>

            <div className="card p-8">
              <h3 className="font-display text-xl text-ink">Your club perks</h3>
              {perksLoading && <p className="mt-3 text-ink/70">Loading perks…</p>}
              {perksError && <p className="mt-3 text-red-600">{perksError}</p>}
              {!perksLoading && !perksError && perks.length === 0 && (
                <p className="mt-3 text-ink/70">
                  Perks aren't listed yet. Check back soon or ask us at the tasting room.
                </p>
              )}
              {!perksLoading && !perksError && perks.length > 0 && (
                <ul className="mt-4 space-y-4">
                  {perks.map((p) => (
                    <li key={p.id} className="border-l-2 border-brand-600 pl-4">
                      <p className="font-medium text-ink">{p.title}</p>
                      <p className="text-sm text-ink/70">{p.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("tibly-app-root")!).render(<App />);