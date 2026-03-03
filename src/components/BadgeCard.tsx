"use client";

interface BadgeCardProps {
  tokenId: string;
  owner?: string;
  date?: string;
}

export default function BadgeCard({ tokenId, owner, date }: BadgeCardProps) {
  const truncatedOwner = owner
    ? `${owner.slice(0, 10)}...${owner.slice(-6)}`
    : "Unknown";

  return (
    <div className="border border-border p-4 sm:p-6 relative overflow-hidden group hover:border-border-dark transition-colors">
      <div className="text-cleared font-bold text-xl sm:text-2xl mb-2">
        Cleared #{tokenId}
      </div>

      <div className="space-y-1 text-sm text-fg-muted">
        <div>
          <span className="text-fg-light">Subject: </span>
          <span className="text-fg font-mono">{truncatedOwner}</span>
        </div>
        {date && (
          <div>
            <span className="text-fg-light">Date: </span>
            <span className="text-fg">{date}</span>
          </div>
        )}
        <div>
          <span className="text-fg-light">Method: </span>
          <span className="text-fg">Inbox Scan</span>
        </div>
      </div>
    </div>
  );
}
