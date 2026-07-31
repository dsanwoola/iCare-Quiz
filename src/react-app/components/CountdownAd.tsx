import type { CountdownAd } from "@/shared/types";
import { HOUSE_AD } from "@/shared/types";
import { Megaphone } from "lucide-react";

interface CountdownAdProps {
  sessionAd?: CountdownAd | null;
  defaultAd?: CountdownAd | null;
  dark?: boolean;
}

/** Resolves the ad shown on the get-ready screen: the game's sponsor ad, else
 *  the admin's app-wide default, else the house "advertise here" invite. */
export default function CountdownAdSlot({ sessionAd, defaultAd, dark = false }: CountdownAdProps) {
  const ad: CountdownAd = sessionAd?.text ? sessionAd : defaultAd?.text ? defaultAd : HOUSE_AD;
  const isHouse = ad === HOUSE_AD;

  const body = (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-colors ${
        dark ? "bg-white/10 border-white/15 hover:bg-white/15" : "bg-card border-border hover:border-primary/40"
      }`}
    >
      {ad.imageUrl ? (
        <img src={ad.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
      ) : (
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            isHouse ? "gradient-secondary text-neutral-900" : "gradient-primary text-white"
          }`}
        >
          <Megaphone className="w-5 h-5" />
        </div>
      )}
      <div className="text-left min-w-0">
        <div className={`text-[10px] uppercase tracking-wider ${dark ? "text-white/50" : "text-muted-foreground"}`}>
          {isHouse ? "Advertising" : "Sponsored"}
        </div>
        <div className={`text-sm font-medium leading-snug ${dark ? "text-white/90" : ""}`}>{ad.text}</div>
      </div>
    </div>
  );

  const href =
    ad.url ||
    (isHouse ? "mailto:hello@neighboursquiz.app?subject=Advertise%20on%20Neighbours%20Quiz%20Arena" : undefined);

  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="block w-full max-w-md mx-auto">
      {body}
    </a>
  ) : (
    <div className="w-full max-w-md mx-auto">{body}</div>
  );
}
