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
  GripVertical,
  MailPlus,
  Upload,
  X,
} from "lucide-react";
import {
  DragDropContext,
  Draggable,
  Droppable,
} from "@hello-pangea/dnd";
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
  const raw = String(text || "").trim();
  if (
    raw.startsWith("<!DOCTYPE") ||
    raw.includes("<html") ||
    raw.includes("Cannot GET /api/")
  ) {
    return "Could not reach the API (got an HTML error page). In production set VITE_API_BASE_URL to your backend URL. Locally run the API and ensure the Vite dev proxy targets the same PORT as the server.";
  }
  try {
    const j = JSON.parse(raw);
    return j.error || raw;
  } catch {
    return raw || "Request failed";
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildMemberDetailsFromSelected(selectedMembers, isAdminWizard = true) {
  return selectedMembers.map((m) => {
    const userId = UUID_RE.test(m.id) ? m.id : "";
    if (m.isPending && m.pendingEmail) {
      return {
        userId: "",
        name: "",
        email: m.pendingEmail,
        role: !isAdminWizard ? "Member" : m.role,
      };
    }
    if (m.isPending && m.pendingUsername) {
      const email =
        typeof m.email === "string" ? m.email.trim().toLowerCase() : "";
      return {
        userId: "",
        name: m.pendingUsername,
        email,
        role: !isAdminWizard ? "Member" : m.role,
      };
    }
    const name =
      [m.firstName, m.lastName].filter(Boolean).join(" ").trim() ||
      m.label ||
      "";
    const email =
      typeof m.email === "string" ? m.email.trim().toLowerCase() : "";
    const roleOut =
      !isAdminWizard && m.isCreator
        ? "Admin (Chairperson)"
        : !isAdminWizard
          ? "Member"
          : m.role;
    return {
      userId,
      name,
      email,
      role: roleOut,
    };
  });
}

/** Treasurer must be another registered user (real UUID id). */
function resolveMemberTreasurerPayload(selectedMembers, treasurerMemberId, myUserId) {
  const t = selectedMembers.find((m) => m.id === treasurerMemberId);
  if (!t || t.isCreator || t.id === myUserId) {
    return { error: "Choose a treasurer who is not yourself." };
  }
  if (!UUID_RE.test(t.id)) {
    return {
      error:
        "A registered user must be selected as the Treasurer (email-only invites cannot be treasurer).",
    };
  }
  return { treasurerUserId: t.id.trim().toLowerCase() };
}

function formatRegisteredMemberOptionLabel(m) {
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
  const handle = m.username ? `@${m.username}` : "";
  if (name && handle) return `${name} (${handle})`;
  return name || handle || "Member";
}

/** Non-creator members with platform accounts (UUID ids). */
function registeredNonCreatorMembers(selectedMembers, myUserId) {
  return selectedMembers.filter(
    (m) =>
      !m.isCreator &&
      myUserId &&
      m.id !== myUserId &&
      UUID_RE.test(String(m.id || "")),
  );
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

/** Registered roster UUIDs in table order (creator first, then others). */
function rosterRegisteredUuidsInOrder(selectedMembers) {
  const out = [];
  for (const m of selectedMembers) {
    const id = String(m?.id ?? "").trim().toLowerCase();
    if (UUID_RE.test(id)) out.push(id);
  }
  return out;
}

function memberByUuid(selectedMembers, uuid) {
  const u = String(uuid ?? "").trim().toLowerCase();
  return (
    selectedMembers.find((m) => String(m.id ?? "").trim().toLowerCase() === u) ??
    null
  );
}

function memberPayoutRowRoleLabel(m, isAdminWizard) {
  if (!m) return "—";
  if (m.isCreator && !isAdminWizard) return "Admin (Chairperson)";
  if (!isAdminWizard) return "Member";
  if (m.isPending) return "Member (invite pending)";
  return typeof m.role === "string" && m.role.trim() ? m.role : "Member";
}

/** @param {{ variant?: 'admin' | 'member' }} props */
export function CreateStokvelWizard({ variant = "admin" }) {
  const { session } = useSession();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const isAdmin = variant === "admin";

  const [activeTab, setActiveTab] = useState(/** @type {'details' | 'members' | 'documents'} */("details"));
  const [name, setName] = useState("");
  const [type, setType] = useState("Rotating");
  const [contributionAmount, setContributionAmount] = useState("");
  const [payoutOrderType, setPayoutOrderType] = useState(
    /** @type {'randomize' | 'manual'} */("randomize"),
  );
  const [proposedPayoutSequence, setProposedPayoutSequence] = useState(
    /** @type {string[]} */([]),
  );
  const [meetingFrequency, setMeetingFrequency] = useState("monthly");
  const [cycleLength, setCycleLength] = useState("1");
  const [isPublic, setIsPublic] = useState(false);
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
  /** Non-creator member id chosen as treasurer (member apply flow only). */
  const [treasurerMemberId, setTreasurerMemberId] = useState("");

  const [emailPopoverId, setEmailPopoverId] = useState(/** @type {string | null} */(null));
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

  const handleGoTabNext = useCallback(() => {
    const i = TAB_ORDER.indexOf(activeTab);
    if (!isAdmin && activeTab === "members") {
      setFormError("");
      if (selectedMembers.length < 2) {
        setFormError(
          "Add at least one other member (minimum two people including you).",
        );
        return;
      }
      const regOthers = registeredNonCreatorMembers(
        selectedMembers,
        myUserId,
      );
      if (regOthers.length < 1) {
        setFormError(
          "You must add at least one registered user to act as the Treasurer.",
        );
        return;
      }
      if (!treasurerMemberId.trim()) {
        setFormError(
          "Select a designated treasurer. You cannot assign yourself.",
        );
        return;
      }
      const t = selectedMembers.find((m) => m.id === treasurerMemberId);
      if (!t || t.isCreator || !UUID_RE.test(t.id)) {
        setFormError(
          "Choose a registered user as treasurer (not an email-only invite).",
        );
        return;
      }
    }
    if (i < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[i + 1]);
  }, [
    activeTab,
    isAdmin,
    selectedMembers,
    treasurerMemberId,
    myUserId,
  ]);

  useEffect(() => {
    if (!createdStokvel?.id) return undefined;
    const target = isAdmin
      ? `/group/${createdStokvel.id}/dashboard`
      : "/dashboard";
    const id = setTimeout(() => navigate(target), 5000);
    return () => clearTimeout(id);
  }, [createdStokvel, navigate, isAdmin]);

  useEffect(() => {
    if (!myUserId) return;
    setSelectedMembers((prev) => {
      const withoutCreator = prev.filter((m) => m.id !== myUserId);
      const existing = prev.find((m) => m.id === myUserId);
      const label =
        !isAdmin && creatorEmail
          ? `Admin (Chairperson) · ${creatorEmail}`
          : !isAdmin
            ? "Admin (Chairperson)"
            : creatorEmail
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
          role: !isAdmin ? "Admin (Chairperson)" : "Admin",
          isCreator: true,
        };
      return [
        creatorRow,
        ...withoutCreator.map((m) => ({ ...m, isCreator: false })),
      ];
    });
  }, [myUserId, creatorEmail, isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    const reg = registeredNonCreatorMembers(selectedMembers, myUserId);
    if (reg.length === 1) {
      setTreasurerMemberId((prev) => prev || reg[0].id);
    }
  }, [selectedMembers, isAdmin, myUserId]);

  useEffect(() => {
    if (isAdmin) return;
    const allowed = new Set(
      registeredNonCreatorMembers(selectedMembers, myUserId || "").map(
        (m) => m.id,
      ),
    );
    if (treasurerMemberId && !allowed.has(treasurerMemberId)) {
      setTreasurerMemberId("");
    }
  }, [selectedMembers, treasurerMemberId, isAdmin, myUserId]);

  useEffect(() => {
    const n = Math.max(1, selectedMembers.length);
    setCycleLength(String(n));
  }, [selectedMembers.length]);

  /** Keep proposed UUID list aligned with roster; preserve manual drag order for existing ids. */
  useEffect(() => {
    const rosterIds = rosterRegisteredUuidsInOrder(selectedMembers);
    if (payoutOrderType !== "manual") {
      setProposedPayoutSequence([]);
      return;
    }
    setProposedPayoutSequence((prev) => {
      const rosterSet = new Set(rosterIds);
      const kept = prev.filter((id) => rosterSet.has(id));
      const keptSet = new Set(kept);
      const appended = rosterIds.filter((id) => !keptSet.has(id));
      return [...kept, ...appended];
    });
  }, [selectedMembers, payoutOrderType]);

  const handlePayoutDragEnd = useCallback((result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    setProposedPayoutSequence((items) => {
      const next = Array.from(items);
      const [removed] = next.splice(result.source.index, 1);
      next.splice(result.destination.index, 0, removed);
      return next;
    });
  }, []);

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
        const usersPath = isAdmin ? "/api/admin/users" : "/api/stokvels/members/search";
        const res = await fetch(
          apiUrl(`${usersPath}?q=${encodeURIComponent(q)}`),
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
  }, [memberQuery, session?.access_token, isAdmin]);

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
    if (!isAdmin) return "";
    const t = selectedMembers.find(
      (m) => m.role === "Treasurer" && UUID_RE.test(m.id),
    );
    return t?.id || myUserId || "";
  }, [selectedMembers, myUserId, isAdmin]);

  const regTreasurerOptions = useMemo(
    () => registeredNonCreatorMembers(selectedMembers, myUserId || ""),
    [selectedMembers, myUserId],
  );

  const memberTabNextDisabled =
    !isAdmin && activeTab === "members" && regTreasurerOptions.length === 0;

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

    let memberTreasurerPayload = {};
    if (!isAdmin) {
      if (selectedMembers.length < 2) {
        return setFormError(
          "Add at least one other member (minimum two people including you).",
        );
      }
      if (registeredNonCreatorMembers(selectedMembers, myUserId).length < 1) {
        return setFormError(
          "You must add at least one registered user to act as the Treasurer.",
        );
      }
      const tr = resolveMemberTreasurerPayload(
        selectedMembers,
        treasurerMemberId,
        myUserId,
      );
      if ("error" in tr && tr.error) return setFormError(tr.error);
      memberTreasurerPayload = { treasurerUserId: tr.treasurerUserId };
    }

    const treasurerIdForAdmin = treasurerUserIdFromSelection || myUserId;
    if (
      !window.confirm(
        "Create this group with the selected settings and members?",
      )
    )
      return;

    const rosterUuidList = rosterRegisteredUuidsInOrder(selectedMembers);
    if (payoutOrderType === "manual") {
      if (proposedPayoutSequence.length !== rosterUuidList.length) {
        return setFormError(
          `Manual payout order must list every registered member once (${rosterUuidList.length} expected, ${proposedPayoutSequence.length} in order). Use the Members tab to fix the list or choose Randomize.`,
        );
      }
      const seqSet = new Set(proposedPayoutSequence);
      if (seqSet.size !== proposedPayoutSequence.length) {
        return setFormError(
          "Manual payout order has duplicate entries. Re-order the list or switch to Randomize.",
        );
      }
      const rosterSet = new Set(rosterUuidList);
      for (const id of proposedPayoutSequence) {
        if (!rosterSet.has(id)) {
          return setFormError(
            "Manual payout order includes an ID that is not on the roster.",
          );
        }
      }
      for (const id of rosterUuidList) {
        if (!seqSet.has(id)) {
          return setFormError(
            "Manual payout order is missing a registered member.",
          );
        }
      }
    }

    const initialMemberIds = selectedMembers
      .filter((m) => m.id !== myUserId && UUID_RE.test(m.id))
      .map((m) => m.id);
    const memberDetailsPayload = buildMemberDetailsFromSelected(
      selectedMembers,
      isAdmin,
    );
    const membersCount = selectedMembers.length;

    setSubmitting(true);
    try {
      setUploadingDocs(true);
      const documentUrls = await uploadDocuments();
      const createPath = isAdmin ? "/api/admin/stokvels" : "/api/stokvels";
      const res = await fetch(apiUrl(createPath), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          type,
          contributionAmount: amountNum,
          meetingFrequency,
          cycleLength: cycleNum,
          membersCount,
          memberDetails: memberDetailsPayload,
          documents: documentUrls,
          isPublic,
          payout_order_type: payoutOrderType,
          proposed_payout_sequence:
            payoutOrderType === "manual" ? proposedPayoutSequence : [],
          initialMemberIds,
          ...(isAdmin
            ? { treasurerUserId: treasurerIdForAdmin }
            : memberTreasurerPayload),
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
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
      <div className="mx-auto max-w-2xl space-y-6 text-stone-800 dark:text-stone-100">
        <section className={`${cardLight} p-6`}>
          <h1 className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
            {isAdmin ? "Group created" : "Application submitted"}
          </h1>
          <p className="mt-2 text-stone-600 dark:text-stone-300">
            {isAdmin ? (
              <>
                {createdStokvel.name} is live. Add members below or open the
                dashboard.
              </>
            ) : (
              <>
                {createdStokvel.name} has been submitted for approval. Track
                its status from your dashboard.
              </>
            )}
          </p>
        </section>
        {isAdmin ? (
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
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                {inviteOk}
              </p>
            ) : null}
          </section>
        ) : null}
        <Link
          to={isAdmin ? `/group/${createdStokvel.id}/dashboard` : "/dashboard"}
          className={`${btnPrimary} inline-flex`}
        >
          {isAdmin ? "Open group dashboard" : "Back to dashboard"}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-3 pb-10 text-stone-800 dark:text-stone-100 sm:px-0">
      <h1 className="mb-6 border-b border-stone-200 pb-4 text-2xl font-bold tracking-wide text-emerald-800 dark:border-slate-700 dark:text-emerald-300">
        {isAdmin ? "Admin stokvel creation" : "Apply to stokvel"}
      </h1>
      {formError ? <p className={`${errorBox} mb-4`}>{formError}</p> : null}

      <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
        <div className={`${cardLight} overflow-hidden transition-shadow duration-200`}>
          <nav
            className="flex border-b border-stone-200 bg-stone-50/90 dark:border-slate-700 dark:bg-slate-800/70"
            aria-label="Form steps"
          >
            {[
              { id: "details", label: "Details" },
              { id: "members", label: "Members" },
              { id: "documents", label: "Documents" },
            ].map((tab, stepIdx) => (
              <button
                key={tab.id}
                type="button"
                aria-label={`Step ${stepIdx + 1}: ${tab.label}`}
                onClick={() =>
                  setActiveTab(/** @type {'details' | 'members' | 'documents'} */(tab.id))
                }
                className={`relative flex-1 px-3 py-3.5 text-sm font-medium transition-colors duration-200 sm:px-4 sm:text-base ${activeTab === tab.id
                    ? "border-b-2 border-emerald-700 bg-emerald-50/70 text-emerald-800"
                    : "border-b-2 border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-slate-800 dark:hover:text-stone-100"
                  }`}
              >
                <span
                  className={
                    activeTab === tab.id
                      ? "text-emerald-900/75"
                      : "text-stone-500"
                  }
                >
                  {stepIdx + 1}.
                </span>{" "}
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="p-5 sm:p-6">
            {activeTab === "details" ? (
              <div className="space-y-4">
                <p className="text-sm text-stone-500 dark:text-stone-400">
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
                      onChange={(e) => {
                        let val = e.target.value;
                        // Strip leading zeros unless it's just a single "0"
                        val = val.replace(/^0+(?=\d)/, '');
                        setContributionAmount(val);
                      }}
                    />
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
                  <div className="sm:col-span-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/30">
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-emerald-300 accent-emerald-600"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                          Make this Stokvel Public
                        </span>
                        <span className="mt-1 block text-xs text-stone-600 dark:text-stone-300">
                          Anyone on the platform will be able to see and request to join this group.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "members" ? (
              <div className="space-y-5">
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Search registered users.{" "}
                  <span className="font-medium text-stone-800 dark:text-stone-100">Add new member</span>{" "}
                  enables when there are no matches. Max {MAX_GROUP_MEMBERS}{" "}
                  including you. Cycle length:{" "}
                  <span className="font-medium text-stone-800 dark:text-stone-100">{cycleLength}</span>
                  . Use{" "}
                  <span className="font-medium text-stone-800 dark:text-stone-100">Add email</span> when
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
                        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          {searchLoading ? (
                            <li className="px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
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
                            <li className="sticky top-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2 border-b border-stone-200 bg-stone-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-stone-600 dark:border-slate-700 dark:bg-slate-800 dark:text-stone-300">
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
                                  className="border-b border-stone-100 last:border-0 dark:border-slate-700"
                                >
                                  <button
                                    type="button"
                                    disabled={atMemberCap}
                                    className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2 px-3 py-2 text-left text-xs text-stone-800 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-stone-100 dark:hover:bg-slate-800 sm:text-sm"
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
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Sign in to add members.
                  </p>
                ) : null}

                {/* Desktop table */}
                <div className="hidden overflow-x-auto rounded-xl border border-stone-200 dark:border-slate-700 md:block">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-100 text-xs uppercase tracking-wide text-stone-600 dark:border-slate-700 dark:bg-slate-800 dark:text-stone-300">
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
                          className="border-b border-stone-100 transition-colors last:border-0 hover:bg-stone-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                        >
                          <td className="px-4 py-3 text-stone-500 dark:text-stone-400">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 text-stone-800 dark:text-stone-100">
                            <span
                              className="block max-w-32 truncate"
                              title={displayUsername(m)}
                            >
                              {displayUsername(m)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-stone-800 dark:text-stone-100">
                            <span
                              className="block max-w-40 truncate"
                              title={
                                m.isCreator && !isAdmin
                                  ? "Admin (Chairperson)"
                                  : displayName(m)
                              }
                            >
                              {m.isCreator && !isAdmin
                                ? "Admin (Chairperson)"
                                : displayName(m)}
                            </span>
                          </td>
                          <td className="min-w-40 px-4 py-3 text-stone-800 dark:text-stone-100">
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
                            {!isAdmin ? (
                              m.isCreator ? (
                                <span className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
                                  Admin (Chairperson)
                                </span>
                              ) : (
                                <span className="text-sm text-stone-700 dark:text-stone-300">
                                  Member
                                </span>
                              )
                            ) : m.isPending ? (
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
                              <span className="text-xs text-stone-400 dark:text-stone-500">—</span>
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
                      className="rounded-xl border border-stone-200 bg-stone-50 p-4 transition-colors hover:bg-stone-100/80 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                    >
                      <div className="flex gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-lg font-semibold text-emerald-800 dark:border-slate-600 dark:bg-slate-900 dark:text-emerald-300"
                          aria-hidden
                        >
                          {memberAvatarLetter(m)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-stone-900 dark:text-stone-100">
                                {m.isCreator && !isAdmin
                                  ? "Admin (Chairperson)"
                                  : displayName(m)}
                              </p>
                              <p className="text-sm text-stone-600 dark:text-stone-300">
                                {displayUsername(m)}
                              </p>
                              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                                Row {idx + 1}
                                {memberShowsEmailInput(m, creatorEmail) ? null : (
                                  <>
                                    {" · "}
                                    <span className="text-stone-600 dark:text-stone-300">
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
                              {!isAdmin ? (
                                <div
                                  className={`${inputLight} mt-1 cursor-default border-stone-200 bg-stone-100 text-stone-800`}
                                >
                                  {m.isCreator
                                    ? "Admin (Chairperson)"
                                    : "Member"}
                                </div>
                              ) : m.isPending ? (
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

                {!isAdmin ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                    <label className={`${labelLight}`}>
                      Designated treasurer{" "}
                      <span className="text-red-700">*</span>
                      <p className="mb-2 mt-1 text-xs font-normal text-stone-600 dark:text-stone-300">
                        Required — must be another{" "}
                        <span className="font-medium text-stone-800 dark:text-stone-100">
                          registered
                        </span>{" "}
                        user (not an email-only invite). Email invites can still
                        join as regular members.
                      </p>
                      {regTreasurerOptions.length === 0 ? (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                          You must add at least one registered user to act as the
                          Treasurer.
                        </p>
                      ) : (
                        <select
                          className={inputLight}
                          value={treasurerMemberId}
                          onChange={(e) =>
                            setTreasurerMemberId(e.target.value)
                          }
                          required
                        >
                          <option value="">Select treasurer…</option>
                          {regTreasurerOptions.map((m) => (
                            <option key={m.id} value={m.id}>
                              {formatRegisteredMemberOptionLabel(m)}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                  </div>
                ) : null}

                <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <p className="mb-1 text-sm font-medium text-stone-800 dark:text-stone-100">
                    Payout order
                  </p>
                  <p className="mb-3 text-xs font-normal text-stone-600 dark:text-stone-300">
                    Applies when an admin activates the group. Randomize shuffles
                    registered members; Manual lets you set the exact sequence
                    (registered users only — email-only invites are added after
                    they join).
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-800 dark:text-stone-100">
                      <input
                        type="radio"
                        name="payoutOrderType"
                        className="h-4 w-4 accent-emerald-600"
                        checked={payoutOrderType === "randomize"}
                        onChange={() => setPayoutOrderType("randomize")}
                      />
                      Randomize at activation
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-800 dark:text-stone-100">
                      <input
                        type="radio"
                        name="payoutOrderType"
                        className="h-4 w-4 accent-emerald-600"
                        checked={payoutOrderType === "manual"}
                        onChange={() => setPayoutOrderType("manual")}
                      />
                      Manual (drag to reorder)
                    </label>
                  </div>

                  {payoutOrderType === "manual" ? (
                    <div className="mt-4">
                      {proposedPayoutSequence.length === 0 ? (
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          Add registered members to set payout order.
                        </p>
                      ) : (
                        <DragDropContext onDragEnd={handlePayoutDragEnd}>
                          <Droppable droppableId="stokvel-payout-order">
                            {(droppableProvided) => (
                              <ul
                                ref={droppableProvided.innerRef}
                                {...droppableProvided.droppableProps}
                                className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-stone-50/80 p-2 dark:border-slate-700 dark:bg-slate-800/60"
                              >
                                {proposedPayoutSequence.map((uid, index) => {
                                  const m = memberByUuid(selectedMembers, uid);
                                  const nameLabel =
                                    m != null
                                      ? m.isCreator && !isAdmin
                                        ? "You"
                                        : displayName(m)
                                      : uid;
                                  return (
                                    <Draggable
                                      key={uid}
                                      draggableId={uid}
                                      index={index}
                                    >
                                      {(dragProvided, snapshot) => (
                                        <li
                                          ref={dragProvided.innerRef}
                                          {...dragProvided.draggableProps}
                                          className={`flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900 ${snapshot.isDragging
                                              ? "ring-2 ring-emerald-500/40"
                                              : ""
                                            }`}
                                        >
                                          <button
                                            type="button"
                                            className="touch-none rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:text-stone-500 dark:hover:bg-slate-800 dark:hover:text-stone-200"
                                            aria-label="Drag to reorder"
                                            {...dragProvided.dragHandleProps}
                                          >
                                            <GripVertical className="h-4 w-4" />
                                          </button>
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium text-stone-900 dark:text-stone-100">
                                              {nameLabel}
                                            </p>
                                            <p className="truncate text-xs text-stone-600 dark:text-stone-300">
                                              {memberPayoutRowRoleLabel(m, isAdmin)}
                                              {m?.username
                                                ? ` · @${m.username}`
                                                : ""}
                                            </p>
                                          </div>
                                        </li>
                                      )}
                                    </Draggable>
                                  );
                                })}
                                {droppableProvided.placeholder}
                              </ul>
                            )}
                          </Droppable>
                        </DragDropContext>
                      )}
                    </div>
                  ) : null}
                </div>

                {selectedMembers.length === 0 ? (
                  <p className="text-xs text-stone-500 dark:text-stone-400">Loading your row…</p>
                ) : null}
              </div>
            ) : null}

            {activeTab === "documents" ? (
              <div className="space-y-4">
                <p className="text-sm text-stone-500 dark:text-stone-400">
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
                  className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200 ${dropzoneActive
                      ? "border-emerald-600 bg-emerald-50/80"
                      : "border-stone-400 bg-stone-50/50 hover:border-stone-500 hover:bg-stone-100/80 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                    }`}
                >
                  <div
                    className={`rounded-full p-4 transition-colors duration-200 ${dropzoneActive ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-stone-100 dark:bg-slate-700"
                      }`}
                  >
                    <Upload
                      className={`h-8 w-8 ${dropzoneActive ? "text-emerald-700 dark:text-emerald-300" : "text-stone-500 dark:text-stone-300"}`}
                      aria-hidden
                    />
                  </div>
                  <div>
                    <p className="font-medium text-stone-800 dark:text-stone-100">
                      Drop PDFs here or click to upload
                    </p>
                    <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                      Stokvel constitution · PDF only
                    </p>
                  </div>
                </button>

                {documentFiles.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {documentFiles.map((file, i) => (
                      <li
                        key={`${file.name}-${i}-${file.size}`}
                        className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm transition-colors hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                      >
                        <FileText className="h-5 w-5 shrink-0 text-emerald-700" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                            {file.name}
                          </p>
                          <p className="text-xs text-stone-500 dark:text-stone-400">
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

            <div
              className={`mt-8 flex flex-wrap items-center gap-3 border-t border-stone-200 pt-6 dark:border-slate-700 ${activeTab === "details" ? "justify-end" : "justify-between"
                }`}
            >
              {activeTab !== "details" ? (
                <button
                  type="button"
                  onClick={goTabPrev}
                  className={`${btnSecondary} inline-flex items-center gap-2`}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
              ) : null}
              {activeTab === "documents" ? (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={submitting || uploadingDocs}
                  className={`${btnPrimary} inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {submitting || uploadingDocs ? "Creating..." : "Create stokvel"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoTabNext}
                  disabled={memberTabNextDisabled}
                  title={
                    memberTabNextDisabled
                      ? "Add a registered member to assign as treasurer before continuing."
                      : undefined
                  }
                  className={`${btnSecondary} inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
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
                  className="text-lg font-semibold text-stone-900 dark:text-stone-100"
                >
                  {emailPopoverMember.isPending &&
                    emailPopoverMember.pendingUsername
                    ? "Add contact email (optional)"
                    : "Add email"}
                </h2>
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
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
