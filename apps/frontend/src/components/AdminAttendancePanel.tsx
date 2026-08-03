import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import {
  Calendar,
  Download,
  FileText,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Printer
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

export default function AdminAttendancePanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  // ── Fetch All Attendance Records ──────────────────────────────────────────
  const fetchAllAttendance = async () => {
    try {
      setLoading(true);
      const url = `/api/attendance/status?date=${selectedDate}`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user?.tenantId) {
        headers["x-tenant-id"] = user.tenantId.toString();
      }

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Failed to fetch attendance data");
      const data = await res.json();
      setRecords(data);

      // Default expand all classes on load
      const initialExpanded: Record<string, boolean> = {};
      data.forEach((r: AttendanceRecord) => {
        const key = `${r.className}-${r.section}`;
        initialExpanded[key] = true;
      });
      setExpandedClasses(initialExpanded);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error fetching attendance",
        description: e.message || "Failed to load database records."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAttendance();
  }, [selectedDate]);

  // ── Filtered Records ──────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    return records.filter(r =>
      r.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [records, searchQuery]);

  // ── Group Data class-wise and section-wise ─────────────────────────────────
  const groupedData = useMemo(() => {
    const groups: Record<string, {
      className: string;
      section: string;
      present: AttendanceRecord[];
      absent: AttendanceRecord[];
      pending: AttendanceRecord[];
    }> = {};

    filteredRecords.forEach(r => {
      const key = `${r.className || "Unassigned"}-${r.section || "Unassigned"}`;
      if (!groups[key]) {
        groups[key] = {
          className: r.className || "Unassigned",
          section: r.section || "Unassigned",
          present: [],
          absent: [],
          pending: []
        };
      }

      if (r.classStatus === 'PRESENT') {
        groups[key].present.push(r);
      } else if (r.classStatus === 'ABSENT') {
        groups[key].absent.push(r);
      } else {
        groups[key].pending.push(r);
      }
    });

    // Sort classes alphanumeric
    return Object.values(groups).sort((a, b) => {
      const classCompare = a.className.localeCompare(b.className, undefined, { numeric: true });
      if (classCompare !== 0) return classCompare;
      return a.section.localeCompare(b.section);
    });
  }, [filteredRecords]);

  // ── Stats Summary ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = records.length;
    const present = records.filter(r => r.classStatus === 'PRESENT').length;
    const absent = records.filter(r => r.classStatus === 'ABSENT').length;
    const pending = records.filter(r => r.classStatus === 'PENDING').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, pending, percentage };
  }, [records]);

  const toggleExpand = (key: string) => {
    setExpandedClasses(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Excel Export (xlsx) ───────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (records.length === 0) {
      toast({
        variant: "destructive",
        title: "No records to export",
        description: "There is no attendance data for the selected date."
      });
      return;
    }

    const dataRows = records.map((r, i) => ({
      "S.N.": i + 1,
      "Full Name": r.fullName,
      "Class": r.className || "N/A",
      "Section": r.section || "N/A",
      "Bus Stop": r.stationName || "N/A",
      "Bus Attendance": r.busStatus,
      "Class Attendance": r.classStatus,
      "Date": r.date,
      "Marked By Driver": r.markedByDriver ? "Yes" : "No",
      "Marked By Teacher": r.markedByTeacher ? "Yes" : "No",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");
    
    // Auto-fit column widths
    const maxLens = Object.keys(dataRows[0] || {}).map(() => 10);
    dataRows.forEach(row => {
      Object.values(row).forEach((val, colIdx) => {
        const len = String(val ?? "").length;
        if (len > maxLens[colIdx]) maxLens[colIdx] = len;
      });
    });
    worksheet["!cols"] = maxLens.map(w => ({ wch: w + 3 }));

    XLSX.writeFile(workbook, `Attendance_Report_${selectedDate}.xlsx`);
    
    toast({
      title: "Excel report exported",
      description: "Workbook downloaded successfully."
    });
  };

  // ── PDF Export (Print Layout inside dynamic Iframe) ──────────────────────
  const handleExportPDF = () => {
    if (records.length === 0) {
      toast({
        variant: "destructive",
        title: "No records to print",
        description: "There is no attendance data for the selected date."
      });
      return;
    }

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (!doc) return;

    let groupedHtml = "";
    groupedData.forEach(group => {
      groupedHtml += `
        <div class="class-section-block">
          <h2>Class ${group.className} - ${group.section}</h2>
          
          <div class="table-container">
            <h3>Present Students (${group.present.length})</h3>
            ${group.present.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>S.N.</th>
                    <th>Student Name</th>
                    <th>Bus Stop</th>
                    <th>Bus Status</th>
                    <th>Class Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${group.present.map((r, i) => `
                    <tr>
                      <td>${i + 1}</td>
                      <td><b>${r.fullName}</b></td>
                      <td>${r.stationName || "No Bus"}</td>
                      <td><span class="status present">${r.busStatus}</span></td>
                      <td><span class="status present">${r.classStatus}</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            ` : `<p class="empty-note">No students present today.</p>`}
          </div>

          <div class="table-container">
            <h3>Absent Students (${group.absent.length})</h3>
            ${group.absent.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>S.N.</th>
                    <th>Student Name</th>
                    <th>Bus Stop</th>
                    <th>Bus Status</th>
                    <th>Class Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${group.absent.map((r, i) => `
                    <tr>
                      <td>${i + 1}</td>
                      <td class="absent-name"><b>${r.fullName}</b></td>
                      <td>${r.stationName || "No Bus"}</td>
                      <td><span class="status ${r.busStatus.toLowerCase()}">${r.busStatus}</span></td>
                      <td><span class="status absent">${r.classStatus}</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            ` : `<p class="empty-note text-green">All students are present.</p>`}
          </div>
        </div>
      `;
    });

    const schoolName = user?.tenant?.name || "OrbitTrack Partner School";

    doc.write(`
      <html>
        <head>
          <title>Attendance Report — ${selectedDate}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #334155; padding: 40px; line-height: 1.5; }
            h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 2px; text-align: center; }
            .subtitle { font-size: 14px; text-align: center; color: #64748b; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 1px; }
            .header-stats { display: flex; justify-content: space-around; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 40px; }
            .stat-box { text-align: center; }
            .stat-box .val { font-size: 20px; font-weight: 800; color: #0f172a; }
            .stat-box .lbl { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-top: 3px; }
            .class-section-block { page-break-inside: avoid; margin-bottom: 45px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
            .class-section-block h2 { font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 15px; border-left: 4px solid #d97706; padding-left: 10px; }
            .table-container { margin-bottom: 20px; }
            .table-container h3 { font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th { background: #f1f5f9; text-align: left; font-size: 11px; font-weight: 700; color: #475569; border-bottom: 1px solid #cbd5e1; padding: 8px 10px; }
            td { border-bottom: 1px solid #f1f5f9; font-size: 12px; padding: 8px 10px; color: #334155; }
            .absent-name { color: #e11d48; }
            .status { display: inline-block; font-size: 9px; font-weight: 850; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; }
            .status.present { background: #ecfdf5; color: #059669; border-color: #a7f3d0; }
            .status.absent { background: #fff1f2; color: #e11d48; border-color: #fecdd3; }
            .status.pending { background: #fef3c7; color: #d97706; border-color: #fde68a; }
            .empty-note { font-size: 11px; color: #94a3b8; font-style: italic; margin-top: 0; }
            .empty-note.text-green { color: #10b981; }
            .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            @media print {
              body { padding: 0; }
              .class-section-block { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>${schoolName}</h1>
          <div class="subtitle">Daily Digital Attendance Report — ${selectedDate}</div>
          
          <div class="header-stats">
            <div class="stat-box"><div class="val">${stats.total}</div><div class="lbl">Registered</div></div>
            <div class="stat-box"><div class="val" style="color: #10b981;">${stats.present}</div><div class="lbl">Present</div></div>
            <div class="stat-box"><div class="val" style="color: #f43f5e;">${stats.absent}</div><div class="lbl">Absent</div></div>
            <div class="stat-box"><div class="val" style="color: #d97706;">${stats.pending}</div><div class="lbl">Pending</div></div>
            <div class="stat-box"><div class="val" style="color: #d97706;">${stats.percentage}%</div><div class="lbl">Attendance Rate</div></div>
          </div>

          ${groupedHtml}

          <div class="footer">
            Generated via OrbitTrack Attendance Management Suite on ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `);

    doc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 500);
    }, 500);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-xl font-black text-foreground">Attendance Panel & Reports</h1>
          <p className="text-muted-foreground text-xs mt-1">
            Group classroom attendance class-wise and section-wise, view history, and export data.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Date Selector */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none focus:border-amber-500"
            />
          </div>
          
          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <Download size={14} />
            Excel
          </button>
          
          {/* Export PDF / Print Button */}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <Printer size={14} />
            PDF Report
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <div className="text-lg font-black text-foreground">{stats.total}</div>
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Total Registered</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl border-l-2 border-l-emerald-500 shadow-sm">
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{stats.present}</div>
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Present Today</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl border-l-2 border-l-rose-500 shadow-sm">
          <div className="text-lg font-black text-rose-600 dark:text-rose-400">{stats.absent}</div>
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Absent Today</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl border-l-2 border-l-amber-500 shadow-sm">
          <div className="text-lg font-black text-amber-600 dark:text-amber-500">{stats.pending}</div>
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Pending Status</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl border-l-2 border-l-blue-500 shadow-sm">
          <div className="text-lg font-black text-blue-600 dark:text-blue-400">{stats.percentage}%</div>
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5 font-semibold">Attendance Rate</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4.5 w-4.5" />
        <input
          type="text"
          placeholder="Search student by name to inspect attendance details…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-card placeholder:text-muted-foreground text-sm text-foreground outline-none focus:border-amber-500"
        />
      </div>

      {/* Attendance List grouped Class-wise */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 bg-muted/10 border border-border rounded-2xl">
            <RefreshCw className="animate-spin text-amber-500" size={32} />
            <p className="text-muted-foreground text-sm">Loading attendance groups...</p>
          </div>
        ) : groupedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/10 border border-border rounded-2xl text-center px-4">
            <Users className="text-muted-foreground mb-2" size={36} />
            <h3 className="text-foreground font-bold text-sm">No records found</h3>
            <p className="text-muted-foreground text-xs mt-1">There are no registered students or attendance logs for this school on the selected date.</p>
          </div>
        ) : (
          groupedData.map((group) => {
            const key = `${group.className}-${group.section}`;
            const isExpanded = expandedClasses[key] !== false;

            return (
              <div key={key} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                
                {/* Collapsible Header */}
                <button
                  onClick={() => toggleExpand(key)}
                  className="w-full flex items-center justify-between p-4 bg-muted/30 border-b border-border hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-background text-amber-600 dark:text-amber-500 font-bold border border-border text-sm">
                      {group.className[0]}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-foreground leading-tight">
                        Class {group.className} — Section {group.section}
                      </h3>
                      <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                        {group.present.length} Present • {group.absent.length} Absent • {group.pending.length} Pending
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="text-muted-foreground h-5 w-5" /> : <ChevronDown className="text-muted-foreground h-5 w-5" />}
                </button>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="p-4 space-y-4">
                    
                    {/* Segregated Layout: Present and Absent side-by-side (grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Left: Present Students Table */}
                      <div className="border border-border rounded-xl overflow-hidden bg-background">
                        <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 border-b border-border flex items-center gap-2">
                          <CheckCircle size={15} className="text-emerald-600 dark:text-emerald-400" />
                          <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            Present Students ({group.present.length})
                          </h4>
                        </div>
                        {group.present.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-xs italic">
                            No students marked present.
                          </div>
                        ) : (
                          <div className="divide-y divide-border">
                            {group.present.map((student) => (
                              <div key={student.studentId} className="p-3 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors">
                                <span className="font-semibold text-foreground">{student.fullName}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground">Bus: {student.busStatus}</span>
                                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Absent Students Table */}
                      <div className="border border-border rounded-xl overflow-hidden bg-background">
                        <div className="p-3 bg-rose-500/10 dark:bg-rose-500/20 border-b border-border flex items-center gap-2">
                          <XCircle size={15} className="text-rose-600 dark:text-rose-400" />
                          <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                            Absent Students ({group.absent.length})
                          </h4>
                        </div>
                        {group.absent.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-xs italic">
                            No students marked absent.
                          </div>
                        ) : (
                          <div className="divide-y divide-border">
                            {group.absent.map((student) => (
                              <div key={student.studentId} className="p-3 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors">
                                <span className="font-semibold text-rose-600 dark:text-rose-400">{student.fullName}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground">Bus: {student.busStatus}</span>
                                  <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Pending Students list (below if any exist) */}
                    {group.pending.length > 0 && (
                      <div className="border border-border rounded-xl overflow-hidden bg-background">
                        <div className="p-2.5 bg-amber-500/10 dark:bg-amber-500/20 border-b border-border flex items-center gap-2">
                          <AlertCircle size={14} className="text-amber-600 dark:text-amber-400" />
                          <h4 className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                            Pending Registration Status ({group.pending.length})
                          </h4>
                        </div>
                        <div className="p-3 flex flex-wrap gap-2">
                          {group.pending.map((student) => (
                            <div key={student.studentId} className="px-2.5 py-1 rounded-lg bg-card border border-border text-[11px] text-muted-foreground flex items-center gap-1.5 shadow-sm">
                              <span>{student.fullName}</span>
                              <span className="text-[8px] bg-muted px-1.5 py-0.5 rounded border border-border uppercase text-muted-foreground font-semibold">
                                Bus: {student.busStatus}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
