import { BrowserRouter as Router, Routes, Route } from "react-router";
import { ToastProvider } from "@/react-app/components/ui/toast";
import { AuthProvider } from "@/react-app/hooks/useAuth";
import HomePage from "@/react-app/pages/Home";
import HostDashboard from "@/react-app/pages/HostDashboard";
import HostHistory from "@/react-app/pages/HostHistory";
import QuizEditor from "@/react-app/pages/QuizEditor";
import QuizAnalyticsPage from "@/react-app/pages/QuizAnalytics";
import TemplatesPage from "@/react-app/pages/Templates";
import HostWaitingRoom from "@/react-app/pages/HostWaitingRoom";
import HostLiveGame from "@/react-app/pages/HostLiveGame";
import JoinGame from "@/react-app/pages/JoinGame";
import PlayerWaitingRoom from "@/react-app/pages/PlayerWaitingRoom";
import PlayerGame from "@/react-app/pages/PlayerGame";
import RequireHost from "@/react-app/components/RequireHost";

export default function App() {
  return (
    <AuthProvider>
    <ToastProvider>
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/host" element={<RequireHost><HostDashboard /></RequireHost>} />
        <Route path="/host/history" element={<RequireHost><HostHistory /></RequireHost>} />
        <Route path="/host/create" element={<RequireHost><QuizEditor /></RequireHost>} />
        <Route path="/host/quiz/:quizId/edit" element={<RequireHost><QuizEditor /></RequireHost>} />
        <Route path="/host/quiz/:quizId/analytics" element={<RequireHost><QuizAnalyticsPage /></RequireHost>} />
        <Route path="/host/session/new" element={<RequireHost><HostWaitingRoom /></RequireHost>} />
        <Route path="/host/session/:sessionId/waiting" element={<RequireHost><HostWaitingRoom /></RequireHost>} />
        <Route path="/host/session/:sessionId/live" element={<RequireHost><HostLiveGame /></RequireHost>} />
        <Route path="/join" element={<JoinGame />} />
        <Route path="/join/:gamePin" element={<JoinGame />} />
        <Route path="/play/:gamePin" element={<PlayerWaitingRoom />} />
        <Route path="/play/:gamePin/game" element={<PlayerGame />} />
      </Routes>
    </Router>
    </ToastProvider>
    </AuthProvider>
  );
}
