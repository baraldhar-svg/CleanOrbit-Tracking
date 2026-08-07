import * as React from "react";
import { Bell, Clock, User, MapPin } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { format } from "date-fns";

const fetchNotifications = async (passengerId?: number) => {
  const url = passengerId ? `/api/notifications?passengerId=${passengerId}` : "/api/notifications";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
};

const markAsRead = async (id: number) => {
  const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
  if (!res.ok) throw new Error("Failed to mark as read");
  return res.json();
};

const approveApplication = async (id: number) => {
  const res = await fetch(`/api/notifications/${id}/approve`, { method: "PATCH" });
  if (!res.ok) throw new Error("Failed to approve");
  return res.json();
};

export function NotificationBell({ passengerId, userRole }: { passengerId?: number, userRole?: string }) {
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", passengerId],
    queryFn: () => fetchNotifications(passengerId),
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n: any) => !n.readAt && n.status !== "approved").length;
  
  const [selectedNotif, setSelectedNotif] = React.useState<any>(null);

  const readMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", passengerId] });
      setSelectedNotif((prev: any) => prev ? { ...prev, readAt: new Date().toISOString(), status: 'approved' } : null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: approveApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", passengerId] });
      setSelectedNotif((prev: any) => prev ? { ...prev, status: 'approved', readAt: new Date().toISOString() } : null);
    },
  });

  const handleAction = () => {
    if (!selectedNotif) return;
    const isLeave = selectedNotif.type === "absent" || selectedNotif.title.toLowerCase().includes("leave");
    
    // Only Admin can approve leaves. If it's a student viewing it, they can only Mark as Read.
    if (isLeave && userRole === "admin") {
      approveMutation.mutate(selectedNotif.id);
    } else {
      readMutation.mutate(selectedNotif.id);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative mr-2">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full text-xs"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 max-h-[80vh] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((n: any) => (
              <DropdownMenuItem 
                key={n.id} 
                className="flex flex-col items-start p-3 cursor-pointer hover:bg-slate-50 border-b last:border-0"
                onClick={() => setSelectedNotif(n)}
              >
                <div className="flex justify-between w-full mb-1">
                  <span className={`font-medium text-sm ${!n.readAt && n.status !== 'approved' ? 'text-blue-600 font-bold' : ''}`}>
                    {n.title}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {format(new Date(n.createdAt), "HH:mm")}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2 w-full text-left">
                  {n.body}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!selectedNotif} onOpenChange={(open) => !open && setSelectedNotif(null)}>
        {selectedNotif && (
          <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none bg-transparent shadow-none">
            
            {/* New UI Design matching third image */}
            <div className="bg-white rounded-xl shadow-lg relative flex flex-col w-full max-h-[90vh]">
              {/* Header */}
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Clock className="w-5 h-5 text-red-500" />
                  {selectedNotif.title}
                </DialogTitle>
                <DialogDescription className="sr-only">Notification Details</DialogDescription>
              </div>

              {/* Scrollable Content */}
              <div className="p-4 overflow-y-auto">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4">
                  <div className="flex items-center text-blue-800 font-semibold mb-4 text-sm pb-2 border-b border-blue-100">
                    <User className="w-4 h-4 mr-2 opacity-70" />
                    Sender Student & Parent Details / पठाइएको विद्यार्थीको विवरण
                  </div>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-[13px]">
                    <div>
                      <div className="text-slate-500 mb-0.5">Student Name (विद्यार्थी)</div>
                      <div className="font-bold text-slate-800">
                        {selectedNotif.passengerName || selectedNotif.metadata?.passengerName || "N/A"}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-0.5">Class & Roll Number</div>
                      <div className="font-bold text-slate-800">
                        {selectedNotif.className ? `Class ${selectedNotif.className}` : 'N/A'}
                        {selectedNotif.section ? ` (${selectedNotif.section})` : ''}
                        {selectedNotif.rollNumber ? ` • Roll No: ${selectedNotif.rollNumber}` : ''}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-0.5">Parent Name & Phone</div>
                      <div className="font-bold text-slate-800 leading-tight">
                        {selectedNotif.parentName || selectedNotif.metadata?.parentName || "N/A"}
                        {selectedNotif.passengerPhone && (
                          <div className="font-normal mt-0.5">({selectedNotif.passengerPhone})</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-0.5">Bus Route & Station</div>
                      <div className="font-bold text-slate-800 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                        <span className="leading-tight">
                           {selectedNotif.routeName || "N/A"} • {selectedNotif.stationName || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50/70 rounded-xl p-3 flex items-center justify-between border border-amber-200/60 mb-5">
                  <div className="text-slate-600 font-medium text-sm leading-tight">
                    Application<br/>Status:
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs uppercase ${
                    selectedNotif.status === "approved" || selectedNotif.readAt 
                      ? "bg-green-100 text-green-700" 
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                    <div className="flex flex-col items-center">
                      <span>{selectedNotif.status === "approved" || selectedNotif.readAt ? "APPROVED" : "PENDING REVIEW"}</span>
                      <span className="text-[9px] font-normal lowercase leading-none opacity-80 mt-0.5">
                        {selectedNotif.status === "approved" || selectedNotif.readAt ? "(स्वीकृत)" : "(प्रतीक्षारत)"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-slate-500 font-semibold mb-2 text-sm px-1">
                  Application Letter / Message Content:
                </div>
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed min-h-[80px]">
                  {selectedNotif.body}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="p-4 pt-2 flex items-stretch gap-2 mt-auto">
                {(!selectedNotif.readAt && selectedNotif.status !== 'approved') ? (
                  <>
                    {(userRole === "admin" && (selectedNotif.type === "absent" || selectedNotif.title.toLowerCase().includes("leave"))) && (
                      <Button 
                        onClick={handleAction} 
                        disabled={approveMutation.isPending}
                        className="flex-1 bg-[#059669] hover:bg-[#047857] h-auto py-2.5 flex-col gap-0.5"
                      >
                        <span className="font-bold text-[13px]">Approve Application ✓</span>
                        <span className="text-[10px] font-normal opacity-90">(स्वीकृत गर्नुहोस्)</span>
                      </Button>
                    )}
                    
                    {/* Mark as Read Button */}
                    <Button 
                      onClick={() => readMutation.mutate(selectedNotif.id)} 
                      disabled={readMutation.isPending}
                      variant="default"
                      className={`h-auto py-2.5 flex-col gap-0.5 bg-orange-500 hover:bg-orange-600 ${
                         (userRole === "admin" && (selectedNotif.type === "absent" || selectedNotif.title.toLowerCase().includes("leave"))) 
                           ? "w-24 px-2" 
                           : "flex-1"
                      }`}
                    >
                      <span className="font-bold text-[13px] leading-tight text-center">Mark as<br/>Read ✓</span>
                    </Button>
                  </>
                ) : (
                   <Button disabled variant="outline" className="flex-1 bg-green-50 border-green-200 text-green-700 h-auto py-3 font-semibold">
                     Already Seen / Approved ✓
                   </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedNotif(null)}
                  className="h-auto py-3 w-20 font-semibold text-slate-600"
                >
                  Close
                </Button>
              </div>

            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
