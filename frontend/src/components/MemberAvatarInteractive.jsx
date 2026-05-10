/**
 * Member / profile circle with hover scale, green ring, and tooltip (hover-capable devices only).
 */
export default function MemberAvatarInteractive({ name, statusLabel, className = '', children }) {
  return (
    <span className={`stkg-member-avatar ${className}`.trim()}>
      <span className="stkg-member-avatar__surface">{children}</span>
      <span className="stkg-member-avatar__tooltip" role="tooltip">
        <span className="stkg-member-avatar__tooltip-name">{name}</span>
        <span className="stkg-member-avatar__tooltip-status">{statusLabel}</span>
      </span>
    </span>
  )
}
