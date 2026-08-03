import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/components/VehicleLiveMap";
import {
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Search,
  RefreshCw,
  Award,
  Bus,
  Save
} from "lucide-react";

interface AttendanceRecord {
  studentId: string;
  fullName: string;
  photoUrl: string | null;
  className: string;
  section: string;
  stationName: string;
  parentId: string | null;
  date: string;
  busStatus: 'PRESENT' | 'ABSENT' | 'PENDING';
  classStatus: 'PRESENT' | 'ABSENT' | 'PENDING';
  markedByDriver: boolean;
  markedByTeacher: boolean;
  attendanceId: number | null;
}

export default function TeacherPortal({ tenant }: { tenant: any }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState<AttendanceRecord[]>([]);

  const assignedClass = user?.assignedClass || "";
  const assignedSection = user?.assignedSection || "";

  // ── Fetch Attendance Status ───────────────────────────────────────────────
  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const url = `/api/attendance/status?className=${encodeURIComponent(assignedClass)}&section=${encodeURIComponent(assignedSection)}&date=${selectedDate}`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user?.tenantId) {
        headers["x-tenant-id"] = user.tenantId.toString();
      }
      
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Failed to load attendance");
      const data = await res.json();
      setStudents(data);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error loading attendance",
        description: e.message || "Please try again later."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assignedClass && assignedSection) {
      fetchAttendance();
    }
  }, [assignedClass, assignedSection, selectedDate]);

  // ── Supabase Realtime Listener ─────────────────────────────────────────────
  useEffect(() => {
    const client = supabase;
    if (!client) return;

    // Subscribe to attendance_records table changes on Supabase
    const channel = client
      .channel("teacher-attendance-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_records"
        },
        () => {
          // Instantly refresh list when database changes are made by driver or system
          fetchAttendance();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [selectedDate, assignedClass, assignedSection]);

  // ── Toggle Student Class Status ───────────────────────────────────────────
  const handleMarkAttendance = async (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    try {
      // Optimitic local UI update
      setStudents(prev =>
        prev.map(s =>
          s.studentId === studentId
            ? { ...s, classStatus: status, markedByTeacher: true }
            : s
        )
      );

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user?.tenantId) {
        headers["x-tenant-id"] = user.tenantId.toString();
      }

      const res = await fetch("/api/attendance/mark", {
        method: "POST",
        headers,
        body: JSON.stringify({
          records: [
            {
              studentId,
              date: selectedDate,
              classStatus: status,
              markedByTeacher: true
            }
          ]
        })
      });

      if (!res.ok) throw new Error("Failed to update status");
      
      toast({
        title: "Attendance marked",
        description: "Successfully updated student's classroom attendance."
      });
    } catch (e: any) {
      // Revert in case of error
      fetchAttendance();
      toast({
        variant: "destructive",
        title: "Failed to mark",
        description: e.message || "Failed to sync attendance with server."
      });
    }
  };

  // ── Confirm Sync (Pre-fill Classroom attendance with Bus Attendance) ──────
  const handleSyncFromBus = async () => {
    setSaving(true);
    try {
      const recordsToSync = students
        .filter(s => s.busStatus !== 'PENDING' && s.classStatus === 'PENDING')
        .map(s => ({
          studentId: s.studentId,
          date: selectedDate,
          classStatus: s.busStatus, // sync
          markedByTeacher: true
        }));

      if (recordsToSync.length === 0) {
        toast({
          title: "Nothing to sync",
          description: "All student statuses are already matching or pending."
        });
        setSaving(false);
        return;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user?.tenantId) {
        headers["x-tenant-id"] = user.tenantId.toString();
      }

      const res = await fetch("/api/attendance/mark", {
        method: "POST",
        headers,
        body: JSON.stringify({ records: recordsToSync })
      });

      if (!res.ok) throw new Error("Failed to sync records");
      
      toast({
        title: "Sync completed",
        description: `Successfully synced ${recordsToSync.length} students from bus attendance.`
      });
      fetchAttendance();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: e.message || "Please try again."
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered list by query ────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    return students.filter(s =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  // ── Attendance stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = students.length;
    const present = students.filter(s => s.classStatus === 'PRESENT').length;
    const absent = students.filter(s => s.classStatus === 'ABSENT').length;
    const pending = students.filter(s => s.classStatus === 'PENDING').length;
    const busPresent = students.filter(s => s.busStatus === 'PRESENT').length;
    return { total, present, absent, pending, busPresent };
  }, [students]);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6 space-y-6">
      
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-semibold uppercase tracking-wider">
              Class Teacher
            </span>
            <span className="text-slate-400 text-sm">Dashboard</span>
          </div>
          <h1 className="text-2xl font-black text-white">
            Class {assignedClass} — Section {assignedSection}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage attendance, review bus transport syncs, and verify student presence.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-44">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>
          <button
            onClick={fetchAttendance}
            className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white transition-colors"
            title="Refresh database"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-2xl flex items-center gap-4">
          <div className="h-10 w-10 bg-slate-800 text-slate-300 rounded-xl flex items-center justify-center">
            <Users size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{stats.total}</div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Total</div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-2xl flex items-center gap-4">
          <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400">{stats.present}</div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Present</div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-2xl flex items-center gap-4">
          <div className="h-10 w-10 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl flex items-center justify-center">
            <XCircle size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-400">{stats.absent}</div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Absent</div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-2xl flex items-center gap-4">
          <div className="h-10 w-10 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-400">{stats.pending}</div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Pending</div>
          </div>
        </div>
      </div>

      {/* Control Actions & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4.5 w-4.5" />
          <input
            type="text"
            placeholder="Search student by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 placeholder:text-slate-500 text-sm text-white outline-none focus:border-amber-500"
          />
        </div>
        
        {/* Pre-fill from Bus Attendance Button */}
        <button
          onClick={handleSyncFromBus}
          disabled={saving || stats.total === 0}
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 px-4 py-2.5 text-sm font-bold text-white transition-colors cursor-pointer"
        >
          <Bus size={16} />
          {saving ? "Syncing..." : "Sync Bus Status"}
        </button>
      </div>

      {/* Students List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-slate-900/20 border border-slate-800 rounded-2xl">
            <RefreshCw className="animate-spin text-amber-500" size={32} />
            <p className="text-slate-400 text-sm">Retrieving student records...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2 bg-slate-900/20 border border-slate-800 rounded-2xl text-center px-4">
            <Users className="text-slate-600" size={40} />
            <h3 className="text-white font-bold">No students found</h3>
            <p className="text-slate-500 text-xs max-w-xs">
              {searchQuery ? "Try refining your query." : `No students registered for Class ${assignedClass} - ${assignedSection}.`}
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800/60 overflow-hidden">
            {filteredStudents.map((student) => {
              const avatar = student.photoUrl ||
                `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(student.fullName)}&backgroundColor=0f172a`;

              return (
                <div key={student.studentId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/10 transition-colors">
                  
                  {/* Left: Name and Station Info */}
                  <div className="flex items-center gap-3">
                    <img
                      src={avatar}
                      alt={student.fullName}
                      className="h-11 w-11 rounded-xl bg-slate-800 object-cover border border-slate-700 shrink-0"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-white leading-tight">
                        {student.fullName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 mt-0.5">
                        <span className="text-slate-500">Bus Stop:</span>
                        <span className="text-amber-500 font-semibold">{student.stationName || "No Bus"}</span>
                        
                        {/* Bus status pill */}
                        {student.stationName && (
                          <>
                            <span className="text-slate-700">•</span>
                            <span className={`inline-flex items-center px-1.5 py-0.2 rounded font-black text-[9px] uppercase tracking-wide border ${
                              student.busStatus === 'PRESENT'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : student.busStatus === 'ABSENT'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              Bus: {student.busStatus}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Toggle Classroom Status */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleMarkAttendance(student.studentId, 'PRESENT')}
                      className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        student.classStatus === 'PRESENT'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <CheckCircle size={14} />
                      Present
                    </button>

                    <button
                      onClick={() => handleMarkAttendance(student.studentId, 'ABSENT')}
                      className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        student.classStatus === 'ABSENT'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <XCircle size={14} />
                      Absent
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
