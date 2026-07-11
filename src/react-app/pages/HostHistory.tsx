import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Card } from "@/react-app/components/ui/card";
import {
  ArrowLeft,
  Download,
  Users,
  Calendar,
  FileText,
  Loader2,
  Clock,
  CheckCircle,
  PlayCircle,
  Trophy,
} from "lucide-react";
import type { SessionHistoryItem } from "@/shared/types";
import { listSessionHistory, exportSessionCsv } from "@/react-app/lib/data";

export default function HostHistory() {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const data = await listSessionHistory();
      setSessions(data);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ENDED":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "LIVE":
        return <PlayCircle className="w-4 h-4 text-red-500 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "ENDED":
        return "Completed";
      case "LIVE":
        return "In Progress";
      default:
        return "Waiting";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/host"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold">
              <span className="text-gradient text-green-800">Game History</span>
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No games played yet</h2>
            <p className="text-muted-foreground mb-6">
              Host your first game to see it here
            </p>
            <Link to="/host">
              <Button className="gradient-primary text-white border-0 rounded-xl">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="p-5 rounded-2xl border hover:border-primary/30 transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    {/* Status indicator */}
                    <div className="gradient-primary w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-white" />
                    </div>

                    {/* Session info */}
                    <div>
                      <h3 className="font-semibold text-lg">{session.quizTitle}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          {getStatusIcon(session.status)}
                          {getStatusText(session.status)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {session.participantCount} player{session.participantCount !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {session.questionCount} question{session.questionCount !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(session.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono bg-muted px-3 py-1 rounded-lg">
                      PIN: {session.gamePin}
                    </span>
                    
                    {session.status === "LIVE" ? (
                      <Link to={`/host/session/${session.id}/live`}>
                        <Button className="gradient-primary text-white border-0 rounded-xl">
                          <PlayCircle className="w-4 h-4 mr-2" />
                          Rejoin
                        </Button>
                      </Link>
                    ) : session.status === "ENDED" ? (
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => exportSessionCsv(session.id)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download CSV
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
