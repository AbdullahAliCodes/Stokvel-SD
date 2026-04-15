import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  MailPlus,
  Upload,
  X,
} from "lucide-react";
import { useSession } from "../context/SessionContext";
import { apiUrl } from "../utils/api";
import {
  btnPrimary,
  btnSecondary,
  cardLight,
  errorBox,
  inputLight,
  labelLight,
} from "../ui";

const MAX_GROUP_MEMBERS = 12;
const PDF_MAX_BYTES = 5 * 1024 * 1024;

const TAB_ORDER = /** @type {const} */ (["details", "members", "documents"]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidManualEmail(s) {
  const t = s.trim().toLowerCase();
  return t.length >= 5 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function normalizeManualUsername(raw) {
  return raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function parseApiError(text) {
  try {
    const j = JSON.parse(text);
    return j.error || text;
  } catch {
    return text || "Request failed";
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildMemberDetailsFromSelected(selectedMembers) {
  return selectedMembers.map((m) => {
    const userId = UUID_RE.test(m.id) ? m.id : "";
    if (m.isPending && m.pendingEmail) {
      return { userId: "", name: "", email: m.pendingEmail, role: m.role };
    }
    if (m.isPending && m.pendingUsername) {
      const email =
        typeof m.email === "string" ? m.email.trim().toLowerCase() : "";
      return { userId: "", name: m.pendingUsername, email, role: m.role };
    }
    const name =
      [m.firstName, m.lastName].filter(Boolean).join(" ").trim() ||
      m.label ||
      "";
    const email =
      typeof m.email === "string" ? m.email.trim().toLowerCase() : "";
    return {
      userId,
      name,
      email,
      role: m.role,
    };
  });
}

function displayEmailReadOnly(m, creatorEmail) {
  if (m.isCreator) {
    if (creatorEmail) return creatorEmail;
    if (typeof m.email === "string" && m.email.trim()) return m.email.trim();
    return "—";
  }
  if (m.pendingEmail) return m.pendingEmail;
  if (typeof m.email === "string" && m.email.trim()) return m.email.trim();
  return "—";
}

function memberShowsEmailInput(m, creatorEmail) {
  if (m.pendingEmail) return false;
  const hasEntered = Boolean(
    typeof m.email === "string" && m.email.trim(),
  );
  if (m.isPending && m.pendingUsername) return !hasEntered;
  if (m.isCreator)
    return !String(creatorEmail || "").trim() && !hasEntered;
  if (m.profileHasEmail) return false;
  if (hasEntered) return false;
  return true;
}

function displayUsername(m) {
  if (m.isCreator) return "—";
  if (m.pendingUsername) return `@${m.pendingUsername}`;
  if (m.username) return `@${m.username}`;
  return "—";
}

function displayName(m) {
  if (m.isCreator) return "You";
  const n = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
  return n || "—";
}

function memberAvatarLetter(m) {
  const n = displayName(m);
  if (n && n !== "—") return n.charAt(0).toUpperCase();
  const u = displayUsername(m);
  if (u && u !== "—") return u.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  return "?";
}

export default function AdminCreateStokvel() {
  const { session } = useSession();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState(/** @type {'details' | 'members' | 'documents'} */ ("details"));
  const [name, setName] = useState("");
  const [type, setType] = useState("Rotating");
  const [contributionAmount, setContributionAmount] = useState("");
  const [payoutStrategy, setPayoutStrategy] = useState("Auto-Rotate");
  const [payoutOrder, setPayoutOrder] = useState("randomize");
  const [meetingFrequency, setMeetingFrequency] = useState("monthly");
  const [cycleLength, setCycleLength] = useState("1");
  const [documentFiles, setDocumentFiles] = useState([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [dropzoneActive, setDropzoneActive] = useState(false);

  const [memberQuery, setMemberQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [lastSearch, setLastSearch] = useState({ query: "", count: -1 });

  const [selectedMembers, setSelectedMembers] = useState([]);

  const [emailPopoverId, setEmailPopoverId] = useState(/** @type {string | null} */ (null));
  const [emailPopoverDraft, setEmailPopoverDraft] = useState("");
  const [emailPopoverError, setEmailPopoverError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOk, setInviteOk] = useState("");
  const [createdStokvel, setCreatedStokvel] = useState(null);

  const myUserId = session?.user?.id;
  const creatorEmail = session?.user?.email;

  const goTabPrev = useCallback(() => {
    const i = TAB_ORDER.indexOf(activeTab);
    if (i > 0) setActiveTab(TAB_ORDER[i - 1]);
  }, [activeTab]);

  const goTabNext = useCallback(() => {
    const i = TAB_ORDER.indexOf(activeTab);
    if (i < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[i + 1]);
  }, [activeTab]);

  useEffect(() => {
    if (!createdStokvel?.id) return undefined;
    const id = setTimeout(
      () => navigate(`/stokvels/${createdStokvel.id}`),
      5000,
    );
    return () => clearTimeout(id);
  }, [createdStokvel, navigate]);

  useEffect(() => {
    if (!myUserId) return;
    setSelectedMembers((prev) => {
      const withoutCreator = prev.filter((m) => m.id !== myUserId);
      const existing = prev.find((m) => m.id === myUserId);
      const label = creatorEmail
        ? `You (creator) · ${creatorEmail}`
        : "You (creator)";
      const profileHasEmail = Boolean(String(creatorEmail || "").trim());
      const creatorRow = existing
        ? {
            ...existing,
            label,
            isCreator: true,
            email: creatorEmail || existing.email || "",
            profileHasEmail,
          }
        : {
            id: myUserId,
            label,
            email: creatorEmail || "",
            profileHasEmail,
            username: "",
            firstName: "",
            lastName: "",
            role: "Admin",
            isCreator: true,
          };
      return [
        creatorRow,
        ...withoutCreator.map((m) => ({ ...m, isCreator: false })),
      ];
    });
  }, [myUserId, creatorEmail]);

  useEffect(() => {
    const n = Math.max(1, selectedMembers.length);
    setCycleLength(String(n));
  }, [selectedMembers.length]);

  useEffect(() => {
    if (!session?.access_token) return undefined;
    const q = memberQuery.trim().replace(/,/g, "");
    if (q.length < 2) {
      setSearchResults([]);
      setSearchError("");
      setLastSearch({ query: "", count: -1 });
      return undefined;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const res = await fetch(
          apiUrl(`/api/admin/users?q=${encodeURIComponent(q)}`),
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
            signal: ctrl.signal,
          },
        );
        const text = await res.text();
        if (!res.ok) throw new Error(parseApiError(text));
        const data = JSON.parse(text);
        const users = Array.isArray(data.users) ? data.users : [];
        setSearchResults(users);
        setLastSearch({ query: q, count: users.length });
      } catch (err) {
        if (err.name !== "AbortError")
          setSearchError(err.message ?? String(err));
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [memberQuery, session?.access_token]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && emailPopoverId) {
        setEmailPopoverId(null);
        setEmailPopoverError("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [emailPopoverId]);

  const addPendingFromRaw = useCallback(
    (raw) => {
      setFormError("");
      const trimmed = raw.trim();
      if (!trimmed) return;
      if (!myUserId) {
        setFormError("Session not ready.");
        return;
      }

      let newMember = null;
      if (trimmed.includes("@")) {
        const email = trimmed.toLowerCase();
        if (!isValidManualEmail(email)) {
          setFormError("Enter a valid email address.");
          return;
        }
        if (creatorEmail && email === creatorEmail.trim().toLowerCase()) {
          setFormError("That is you — you are already in the group.");
          return;
        }
        newMember = {
          id: `pending:email:${email}`,
          isPending: true,
          isCreator: false,
          pendingEmail: email,
          profileHasEmail: true,
          label: `${email} (not on platform yet)`,
          firstName: "",
          lastName: "",
          username: "",
          email: "",
          role: "Member",
        };
      } else {
        const uname = normalizeManualUsername(trimmed);
        if (uname.length < 3 || uname.length > 30) {
          setFormError(
            "Username must be 3–30 characters (letters, numbers, underscore). Use an email if they are not registered yet.",
          );
          return;
        }
        newMember = {
          id: `pending:user:${uname}`,
          isPending: true,
          isCreator: false,
          pendingUsername: uname,
          profileHasEmail: false,
          label: `@${uname} (not on platform yet)`,
          firstName: "",
          lastName: "",
          username: uname,
          email: "",
          role: "Member",
        };
      }

      let postError = "";
      setSelectedMembers((prev) => {
        if (prev.length >= MAX_GROUP_MEMBERS) {
          postError = `Maximum ${MAX_GROUP_MEMBERS} members.`;
          return prev;
        }
        const dup = prev.some((m) => {
          if (m.id === newMember.id) return true;
          if (
            newMember.pendingEmail &&
            m.pendingEmail === newMember.pendingEmail
          )
            return true;
          if (newMember.pendingUsername) {
            if (m.pendingUsername === newMember.pendingUsername) return true;
            if (
              m.username &&
              String(m.username).toLowerCase() === newMember.pendingUsername
            )
              return true;
          }
          return false;
        });
        if (dup) {
          postError = "That person is already listed.";
          return prev;
        }
        return [...prev, newMember];
      });
      if (postError) setFormError(postError);
      else {
        setMemberQuery("");
        setSearchResults([]);
        setSearchOpen(false);
        setLastSearch({ query: "", count: -1 });
      }
    },
    [myUserId, creatorEmail],
  );

  const selectUser = useCallback(
    (u) => {
      if (myUserId && u.id === myUserId) return;
      setSelectedMembers((prev) => {
        if (prev.some((x) => x.id === u.id)) return prev;
        if (prev.length >= MAX_GROUP_MEMBERS) return prev;
        const email = typeof u.email === "string" ? u.email.trim() : "";
        const profileHasEmail = Boolean(email);
        return [
          ...prev,
          {
            ...u,
            email,
            profileHasEmail,
            role: "Member",
            isCreator: false,
          },
        ];
      });
      setMemberQuery("");
      setSearchResults([]);
      setSearchOpen(false);
      setLastSearch({ query: "", count: -1 });
    },
    [myUserId],
  );

  const removeMember = useCallback(
    (id) => {
      if (myUserId && id === myUserId) return;
      setEmailPopoverId((openId) => (openId === id ? null : openId));
      setSelectedMembers((prev) => prev.filter((m) => m.id !== id));
    },
    [myUserId],
  );

  const setMemberRole = useCallback((id, role) => {
    setSelectedMembers((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target?.isPending && role !== "Member") return prev;

      if (role === "Treasurer") {
        return prev.map((m) => {
          if (m.id === id) return { ...m, role };
          if (m.role === "Treasurer") return { ...m, role: "Member" };
          return m;
        });
      }
      if (role === "Admin") {
        return prev.map((m) => {
          if (m.id === id) return { ...m, role };
          if (m.role === "Admin") return { ...m, role: "Member" };
          return m;
        });
      }
      return prev.map((m) => (m.id === id ? { ...m, role } : m));
    });
  }, []);

  const setMemberEmail = useCallback((id, email) => {
    setSelectedMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, email } : m)),
    );
  }, []);

  const openEmailPopover = useCallback((m) => {
    setEmailPopoverId(m.id);
    setEmailPopoverDraft(typeof m.email === "string" ? m.email : "");
    setEmailPopoverError("");
  }, []);

  const saveEmailPopover = useCallback(() => {
    if (!emailPopoverId) return;
    const m = selectedMembers.find((x) => x.id === emailPopoverId);
    if (!m) {
      setEmailPopoverId(null);
      return;
    }
    const d = emailPopoverDraft.trim().toLowerCase();
    if (m.isPending && m.pendingUsername) {
      setMemberEmail(emailPopoverId, d);
      setEmailPopoverId(null);
      setEmailPopoverError("");
      return;
    }
    if (!isValidManualEmail(d)) {
      setEmailPopoverError("Enter a valid email address.");
      return;
    }
    setMemberEmail(emailPopoverId, d);
    setEmailPopoverId(null);
    setEmailPopoverError("");
  }, [emailPopoverId, emailPopoverDraft, selectedMembers, setMemberEmail]);

  const addDocumentFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList || []);
    const toAdd = [];
    let err = "";
    for (const f of incoming) {
      if (
        f.type !== "application/pdf" &&
        !f.name?.toLowerCase().endsWith(".pdf")
      ) {
        err = "Only PDF files are allowed for the constitution upload.";
        continue;
      }
      if (f.size > PDF_MAX_BYTES) {
        err = `Each PDF must be at most ${PDF_MAX_BYTES / (1024 * 1024)}MB.`;
        continue;
      }
      toAdd.push(f);
    }
    if (err) setFormError(err);
    else if (toAdd.length > 0) setFormError("");
    if (toAdd.length > 0) {
      setDocumentFiles((prev) => [...prev, ...toAdd]);
    }
  }, []);

  const removeDocumentAt = useCallback((index) => {
    setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const treasurerUserIdFromSelection = useMemo(() => {
    const t = selectedMembers.find(
      (m) => m.role === "Treasurer" && UUID_RE.test(m.id),
    );
    return t?.id || myUserId || "";
  }, [selectedMembers, myUserId]);

  const atMemberCap = selectedMembers.length >= MAX_GROUP_MEMBERS;

  const qTrim = memberQuery.trim();
  const addNewMemberEnabled =
    qTrim.length >= 2 &&
    lastSearch.query === qTrim &&
    lastSearch.count === 0 &&
    !searchLoading &&
    !searchError &&
    Boolean(myUserId) &&
    !atMemberCap;

  const addNewMemberDisabledReason = useMemo(() => {
    if (!myUserId) return "Sign in to add members.";
    if (atMemberCap) return "Group is full.";
    if (qTrim.length < 2)
      return "Type at least 2 characters to search or add someone new.";
    if (searchError) return "Fix the search error first.";
    if (searchLoading) return "Searching…";
    if (lastSearch.query !== qTrim) return "Waiting for search to finish…";
    if (lastSearch.count > 0)
      return "Matches found — choose someone from the list.";
    return "";
  }, [
    myUserId,
    atMemberCap,
    qTrim.length,
    qTrim,
    searchError,
    searchLoading,
    lastSearch.query,
    lastSearch.count,
  ]);

  async function uploadDocuments() {
    if (!session?.access_token || documentFiles.length === 0) return [];
    const fd = new FormData();
    documentFiles.forEach((file) => fd.append("documents", file));
    const res = await fetch(apiUrl("/api/uploads/documents"), {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to upload documents");
    return Array.isArray(data.documents) ? data.documents : [];
  }

  const handleCreate = async () => {
    setFormError("");
    if (!session?.access_token) return setFormError("You must be signed in.");
    if (!myUserId)
      return setFormError("Session not ready; try again in a moment.");
    const amountNum = Number(contributionAmount);
    const cycleNum = Number(cycleLength);
    if (!name.trim()) return setFormError("Group name is required.");
    if (!Number.isFinite(amountNum) || amountNum <= 0)
      return setFormError("Enter a valid contribution amount.");
    if (!Number.isInteger(cycleNum) || cycleNum < 1)
      return setFormError("Invalid group size for cycle length.");
    if (selectedMembers.length > MAX_GROUP_MEMBERS) {
      return setFormError(
        `A group can have at most ${MAX_GROUP_MEMBERS} members including you.`,
      );
    }
    for (const m of selectedMembers) {
      if (m.pendingEmail) continue;
      const needs = memberShowsEmailInput(m, creatorEmail);
      if (!needs) continue;
      if (m.isPending && m.pendingUsername) continue;
      const e = typeof m.email === "string" ? m.email.trim().toLowerCase() : "";
      if (!isValidManualEmail(e)) {
        const who = m.isCreator
          ? "You (creator)"
          : `@${m.username || "member"}`;
        return setFormError(
          `Enter a valid email for ${who} (missing on profile).`,
        );
      }
    }
    const treasurerId = treasurerUserIdFromSelection || myUserId;
    if (
      !window.confirm(
        "Create this group with the selected settings and members?",
      )
    )
      return;

    const initialMemberIds = selectedMembers
      .filter((m) => m.id !== myUserId && UUID_RE.test(m.id))
      .map((m) => m.id);
    const memberDetailsPayload =
      buildMemberDetailsFromSelected(selectedMembers);
    const membersCount = selectedMembers.length;

    setSubmitting(true);
    try {
      setUploadingDocs(true);
      const documentUrls = await uploadDocuments();
      const res = await fetch(apiUrl("/api/admin/stokvels"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          type,
          contributionAmount: amountNum,
          payoutStrategy,
          payoutOrder,
          meetingFrequency,
          cycleLength: cycleNum,
          membersCount,
          memberDetails: memberDetailsPayload,
          documents: documentUrls,
          initialMemberIds,
          treasurerUserId: treasurerId,
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(parseApiError(text));
      const data = JSON.parse(text);
      setCreatedStokvel(data.stokvel ?? null);
    } catch (err) {
      setFormError(err.message ?? String(err));
    } finally {
      setUploadingDocs(false);
      setSubmitting(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError("");
    setInviteOk("");
    if (!createdStokvel?.id || !session?.access_token) return;
    setInviteSubmitting(true);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/stokvels/${createdStokvel.id}/members`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ username: inviteUsername.trim() }),
        },
      );
      const text = await res.text();
      if (!res.ok) throw new Error(parseApiError(text));
      setInviteOk(`Member added: ${inviteUsername.trim()}`);
      setInviteUsername("");
    } catch (err) {
      setInviteError(err.message ?? String(err));
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleEmailInvite = async (e) => {
    e.preventDefault();
    setInviteError("");
    setInviteOk("");
    if (!createdStokvel?.id || !session?.access_token) return;
    setInviteSubmitting(true);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/stokvels/${createdStokvel.id}/invitations`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ email: inviteEmail.trim() }),
        },
      );
      const text = await res.text();
      if (!res.ok) throw new Error(parseApiError(text));
      setInviteOk(`Invitation sent: ${inviteEmail.trim()}`);
      setInviteEmail("");
    } catch (err) {
      setInviteError(err.message ?? String(err));
    } finally {
      setInviteSubmitting(false);
    }
  };

  const emailPopoverMember = emailPopoverId
    ? selectedMembers.find((x) => x.id === emailPopoverId)
    : null;

  if (createdStokvel) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 text-stone-800">
        <section className={`${cardLight} p-6`}>
          <h1 className="text-xl font-bold text-emerald-800">Group created</h1>
          <p className="mt-2 text-stone-600">
            {createdStokvel.name} is live. Add members below or open the
            dashboard.
          </p>
        </section>
        <section className={`${cardLight} p-6`}>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={handleInvite}
          >
            <label className={`${labelLight} min-w-0 flex-1`}>
              Add by username
              <input
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                className={inputLight}
              />
            </label>
            <button
              type="submit"
              disabled={inviteSubmitting || !inviteUsername.trim()}
              className={btnPrimary}
            >
              {inviteSubmitting ? "Adding..." : "Add member"}
            </button>
          </form>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={handleEmailInvite}
          >
            <label className={`${labelLight} min-w-0 flex-1`}>
              Invite by email
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className={inputLight}
              />
            </label>
            <button
              type="submit"
              disabled={inviteSubmitting || !inviteEmail.trim()}
              className={btnSecondary}
            >
              {inviteSubmitting ? "Sending..." : "Send invite"}
            </button>
          </form>
          {inviteError ? (
            <p className={`${errorBox} mt-3`}>{inviteError}</p>
          ) : null}
          {inviteOk ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {inviteOk}
            </p>
          ) : null}
        </section>
        <Link
          to={`/stokvels/${createdStokvel.id}`}
          className={`${btnPrimary} inline-flex`}
        >
          Open group dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-3 pb-10 text-stone-800 sm:px-0">
      <h1 className="mb-6 border-b border-stone-200 pb-4 text-2xl font-bold tracking-wide text-emerald-800">
        Admin stokvel creation
      </h1>
      {formError ? <p className={`${errorBox} mb-4`}>{formError}</p> : null}

      <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
        <div className={`${cardLight} overflow-hidden transition-shadow duration-200`}>
          <nav
            className="flex border-b border-stone-200 bg-stone-50/90"
            aria-label="Form steps"
          >
            {[
              { id: "details", label: "Details" },
              { id: "members", label: "Members" },
              { id: "documents", label: "Documents" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveTab(/** @type {'details' | 'members' | 'documents'} */ (tab.id))
                }
                className={`relative flex-1 px-3 py-3.5 text-sm font-medium transition-colors duration-200 sm:px-4 sm:text-base ${
                  activeTab === tab.id
                    ? "border-b-2 border-emerald-700 bg-emerald-50/70 text-emerald-800"
                    : "border-b-2 border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="p-5 sm:p-6">
            {activeTab === "details" ? (
              <div className="space-y-4">
                <p className="text-sm text-stone-500">
                  Core stokvel settings. You can move to Members when ready.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={`${labelLight} sm:col-span-2`}>
                    Group name
                    <input
                      className={inputLight}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className={labelLight}>
                    Type
                    <select
                      className={inputLight}
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="Rotating">Rotating</option>
                      <option value="Fixed">Fixed</option>
                      <option value="Investment" disabled>
                        Investment (Coming soon)
                      </option>
                    </select>
                  </label>
                  <label className={labelLight}>
                    Contribution amount (ZAR)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputLight}
                      value={contributionAmount}
                      onChange={(e) => setContributionAmount(e.target.value)}
                    />
                  </label>
                  <label className={labelLight}>
                    Payout schedule
                    <select
                      className={inputLight}
                      value={payoutStrategy}
                      onChange={(e) => setPayoutStrategy(e.target.value)}
                    >
                      <option value="Manual">Manual</option>
                      <option value="Auto-Rotate">Auto-Rotate</option>
                    </select>
                  </label>
                  <label className={labelLight}>
                    Payout order
                    <select
                      className={inputLight}
                      value={payoutOrder}
                      onChange={(e) => setPayoutOrder(e.target.value)}
                    >
                      <option value="randomize">Randomize</option>
                      <option value="manual">Manual</option>
                    </select>
                  </label>
                  <label className={labelLight}>
                    Meeting frequency
                    <select
                      className={inputLight}
                      value={meetingFrequency}
                      onChange={(e) => setMeetingFrequency(e.target.value)}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="bi-annually">Bi-Annually</option>
                    </select>
                  </label>
                </div>
              </div>
            ) : null}

            {activeTab === "members" ? (
              <div className="space-y-5">
                <p className="text-sm text-stone-500">
                  Search registered users.{" "}
                  <span className="font-medium text-stone-800">Add new member</span>{" "}
                  enables when there are no matches. Max {MAX_GROUP_MEMBERS}{" "}
                  including you. Cycle length:{" "}
                  <span className="font-medium text-stone-800">{cycleLength}</span>
                  . Use{" "}
                  <span className="font-medium text-stone-800">Add email</span> when
                  a profile has no address.
                </p>

                <label className={`${labelLight} block`}>
                  Add members
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <div className="relative min-w-0 flex-1">
                      <input
                        value={memberQuery}
                        disabled={!myUserId || atMemberCap}
                        onChange={(e) => {
                          setMemberQuery(e.target.value);
                          setSearchOpen(true);
                        }}
                        onFocus={() => setSearchOpen(true)}
                        onBlur={() =>
                          setTimeout(() => setSearchOpen(false), 200)
                        }
                        className={inputLight}
                        placeholder="Search by name, username, or email…"
                      />
                      {searchOpen &&
                      (searchLoading ||
                        searchResults.length > 0 ||
                        searchError) ? (
                        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg">
                          {searchLoading ? (
                            <li className="px-3 py-2 text-xs text-stone-500">
                              Searching...
                            </li>
                          ) : null}
                          {searchError ? (
                            <li className="px-3 py-2 text-xs text-red-300">
                              {searchError}
                            </li>
                          ) : null}
                          {!searchLoading &&
                          !searchError &&
                          searchResults.length > 0 ? (
                            <li className="sticky top-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2 border-b border-stone-200 bg-stone-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                              <span>Username</span>
                              <span>Name</span>
                              <span>Email</span>
                            </li>
                          ) : null}
                          {searchResults
                            .filter((u) => !myUserId || u.id !== myUserId)
                            .map((u) => {
                              const uname = u.username ? `@${u.username}` : "—";
                              const fullName =
                                [u.firstName, u.lastName]
                                  .filter(Boolean)
                                  .join(" ")
                                  .trim() || "—";
                              const em =
                                u.email && String(u.email).trim()
                                  ? u.email
                                  : "—";
                              return (
                                <li
                                  key={u.id}
                                  className="border-b border-stone-100 last:border-0"
                                >
                                  <button
                                    type="button"
                                    disabled={atMemberCap}
                                    className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2 px-3 py-2 text-left text-xs text-stone-800 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                                    onMouseDown={(ev) => {
                                      ev.preventDefault();
                                      selectUser(u);
                                    }}
                                  >
                                    <span className="truncate" title={uname}>
                                      {uname}
                                    </span>
                                    <span className="truncate" title={fullName}>
                                      {fullName}
                                    </span>
                                    <span className="truncate" title={em}>
                                      {em}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                        </ul>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={!addNewMemberEnabled}
                      title={
                        addNewMemberEnabled
                          ? "Add this person even though they are not registered yet"
                          : addNewMemberDisabledReason
                      }
                      className={`${btnSecondary} shrink-0 whitespace-nowrap px-4 py-2 transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto`}
                      onClick={() => addPendingFromRaw(qTrim)}
                    >
                      Add new member
                    </button>
                  </div>
                </label>

                {atMemberCap ? (
                  <p className="text-xs font-medium text-amber-800">
                    Member limit reached ({MAX_GROUP_MEMBERS}).
                  </p>
                ) : null}
                {!myUserId ? (
                  <p className="text-xs text-stone-500">
                    Sign in to add members.
                  </p>
                ) : null}

                {/* Desktop table */}
                <div className="hidden overflow-x-auto rounded-xl border border-stone-200 md:block">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="w-12 px-2 py-3" aria-label="Remove" />
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMembers.map((m, idx) => (
                        <tr
                          key={m.id}
                          className="border-b border-stone-100 transition-colors last:border-0 hover:bg-stone-50"
                        >
                          <td className="px-4 py-3 text-stone-500">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 text-stone-800">
                            <span
                              className="block max-w-32 truncate"
                              title={displayUsername(m)}
                            >
                              {displayUsername(m)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-stone-800">
                            <span
                              className="block max-w-40 truncate"
                              title={displayName(m)}
                            >
                              {displayName(m)}
                            </span>
                          </td>
                          <td className="min-w-40 px-4 py-3 text-stone-800">
                            {memberShowsEmailInput(m, creatorEmail) ? (
                              <button
                                type="button"
                                onClick={() => openEmailPopover(m)}
                                className={`${btnSecondary} inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors hover:border-emerald-600/50`}
                              >
                                <MailPlus className="h-3.5 w-3.5 shrink-0" />
                                Add email
                              </button>
                            ) : (
                              <span
                                className="block max-w-48 truncate text-sm"
                                title={displayEmailReadOnly(m, creatorEmail)}
                              >
                                {displayEmailReadOnly(m, creatorEmail)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {m.isPending ? (
                              <select
                                className={inputLight}
                                value="Member"
                                disabled
                                aria-label={`Role for ${m.label}`}
                              >
                                <option value="Member">
                                  Member (invite pending)
                                </option>
                              </select>
                            ) : (
                              <select
                                className={inputLight}
                                value={m.role}
                                onChange={(e) =>
                                  setMemberRole(m.id, e.target.value)
                                }
                                aria-label={`Role for ${displayName(m)}`}
                              >
                                <option value="Member">Member</option>
                                <option value="Treasurer">Treasurer</option>
                                <option value="Admin">Admin</option>
                              </select>
                            )}
                          </td>
                          <td className="px-2 py-3 text-right">
                            {m.isCreator || m.id === myUserId ? (
                              <span className="text-xs text-stone-400">—</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => removeMember(m.id)}
                                className={`${btnSecondary} p-2 transition-colors hover:border-red-300 hover:text-red-700`}
                                aria-label="Remove member"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <ul className="flex flex-col gap-3 md:hidden">
                  {selectedMembers.map((m, idx) => (
                    <li
                      key={m.id}
                      className="rounded-xl border border-stone-200 bg-stone-50 p-4 transition-colors hover:bg-stone-100/80"
                    >
                      <div className="flex gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-lg font-semibold text-emerald-800"
                          aria-hidden
                        >
                          {memberAvatarLetter(m)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-stone-900">
                                {displayName(m)}
                              </p>
                              <p className="text-sm text-stone-600">
                                {displayUsername(m)}
                              </p>
                              <p className="mt-1 text-xs text-stone-500">
                                Row {idx + 1}
                                {memberShowsEmailInput(m, creatorEmail) ? null : (
                                  <>
                                    {" · "}
                                    <span className="text-stone-600">
                                      {displayEmailReadOnly(m, creatorEmail)}
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                            {m.isCreator || m.id === myUserId ? null : (
                              <button
                                type="button"
                                onClick={() => removeMember(m.id)}
                                className={`${btnSecondary} shrink-0 p-2`}
                                aria-label="Remove member"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          {memberShowsEmailInput(m, creatorEmail) ? (
                            <button
                              type="button"
                              onClick={() => openEmailPopover(m)}
                              className={`${btnSecondary} mt-3 inline-flex w-full items-center justify-center gap-2 sm:w-auto`}
                            >
                              <MailPlus className="h-4 w-4" />
                              Add email
                            </button>
                          ) : null}
                          <div className="mt-3">
                            <label className={`${labelLight} text-xs`}>
                              Role
                              {m.isPending ? (
                                <select
                                  className={`${inputLight} mt-1`}
                                  value="Member"
                                  disabled
                                >
                                  <option value="Member">
                                    Member (invite pending)
                                  </option>
                                </select>
                              ) : (
                                <select
                                  className={`${inputLight} mt-1`}
                                  value={m.role}
                                  onChange={(e) =>
                                    setMemberRole(m.id, e.target.value)
                                  }
                                >
                                  <option value="Member">Member</option>
                                  <option value="Treasurer">Treasurer</option>
                                  <option value="Admin">Admin</option>
                                </select>
                              )}
                            </label>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {selectedMembers.length === 0 ? (
                  <p className="text-xs text-stone-500">Loading your row…</p>
                ) : null}
              </div>
            ) : null}

            {activeTab === "documents" ? (
              <div className="space-y-4">
                <p className="text-sm text-stone-500">
                  Constitution PDFs only, max {PDF_MAX_BYTES / (1024 * 1024)}MB
                  each. Drag files here or click to browse.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="sr-only"
                  aria-hidden
                  tabIndex={-1}
                  onChange={(e) => {
                    addDocumentFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropzoneActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropzoneActive(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropzoneActive(false);
                    addDocumentFiles(e.dataTransfer.files);
                  }}
                  className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200 ${
                    dropzoneActive
                      ? "border-emerald-600 bg-emerald-50/80"
                      : "border-stone-400 bg-stone-50/50 hover:border-stone-500 hover:bg-stone-100/80"
                  }`}
                >
                  <div
                    className={`rounded-full p-4 transition-colors duration-200 ${
                      dropzoneActive ? "bg-emerald-100" : "bg-stone-100"
                    }`}
                  >
                    <Upload
                      className={`h-8 w-8 ${dropzoneActive ? "text-emerald-700" : "text-stone-500"}`}
                      aria-hidden
                    />
                  </div>
                  <div>
                    <p className="font-medium text-stone-800">
                      Drop PDFs here or click to upload
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      Stokvel constitution · PDF only
                    </p>
                  </div>
                </button>

                {documentFiles.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {documentFiles.map((file, i) => (
                      <li
                        key={`${file.name}-${i}-${file.size}`}
                        className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm transition-colors hover:bg-stone-50"
                      >
                        <FileText className="h-5 w-5 shrink-0 text-emerald-700" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-stone-900">
                            {file.name}
                          </p>
                          <p className="text-xs text-stone-500">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDocumentAt(i)}
                          className={`${btnSecondary} shrink-0 p-2`}
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-6">
              <button
                type="button"
                onClick={goTabPrev}
                disabled={activeTab === "details"}
                className={`${btnSecondary} inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={goTabNext}
                disabled={activeTab === "documents"}
                className={`${btnSecondary} inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 -mx-3 border-t border-stone-200 bg-[#F4F5F0]/95 px-3 py-4 backdrop-blur-sm sm:mx-0 sm:rounded-xl sm:border sm:border-stone-200 sm:bg-white sm:px-4 sm:shadow-sm">
          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting || uploadingDocs}
            className={`${btnPrimary} w-full py-4 text-base uppercase tracking-wide transition-opacity duration-200 disabled:opacity-60`}
          >
            {submitting || uploadingDocs ? "Creating..." : "Create stokvel"}
          </button>
        </div>
      </form>

      {emailPopoverMember ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-popover-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={() => {
              setEmailPopoverId(null);
              setEmailPopoverError("");
            }}
          />
          <div className={`${cardLight} relative z-10 w-full max-w-md p-6 shadow-xl`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="email-popover-title"
                  className="text-lg font-semibold text-stone-900"
                >
                  {emailPopoverMember.isPending &&
                  emailPopoverMember.pendingUsername
                    ? "Add contact email (optional)"
                    : "Add email"}
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {displayName(emailPopoverMember)} ·{" "}
                  {displayUsername(emailPopoverMember)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmailPopoverId(null);
                  setEmailPopoverError("");
                }}
                className={`${btnSecondary} p-2`}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className={labelLight}>
              Email
              <input
                type="email"
                autoComplete="email"
                className={inputLight}
                value={emailPopoverDraft}
                onChange={(e) => {
                  setEmailPopoverDraft(e.target.value);
                  setEmailPopoverError("");
                }}
                placeholder={
                  emailPopoverMember.isPending &&
                  emailPopoverMember.pendingUsername
                    ? "Optional"
                    : "name@example.com"
                }
              />
            </label>
            {emailPopoverError ? (
              <p className={`${errorBox} mt-3 text-sm`}>{emailPopoverError}</p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setEmailPopoverId(null);
                  setEmailPopoverError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={saveEmailPopover}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
