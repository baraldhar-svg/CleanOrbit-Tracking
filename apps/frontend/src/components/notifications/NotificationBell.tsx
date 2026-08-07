import * as React from "react";
import { Bell } from "lucide-react";
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

const fetchNotifications = async () => {
  const res = await fetch("/api/notifications");
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

export function NotificationBell() {
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n: any) => !n.readAt && n.status !== "approved").length;
  
  const [selectedNotif, setSelectedNotif] = React.useState<any>(null);

  const readMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSelectedNotif((prev: any) => prev ? { ...prev, readAt: new Date().toISOString(), status: 'approved' } : null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: approveApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSelectedNotif((prev: any) => prev ? { ...prev, status: 'approved' } : null);
    },
  });

  const handleAction = () => {
    if (!selectedNotif) return;
    const isLeave = selectedNotif.type === "absent" || selectedNotif.title.toLowerCase().includes("leave");
    if (isLeave) {
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl text-center mb-2">
                {selectedNotif.title}
              </DialogTitle>
              <DialogDescription className="text-center font-semibold text-lg text-foreground">
                Sender Details
              </DialogDescription>
            </DialogHeader>
            
            <div className="bg-slate-50 p-4 rounded-lg border text-sm space-y-2">
              {(selectedNotif.passengerName || selectedNotif.metadata?.passengerName) && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground font-medium">Student Name:</span>
                  <span className="col-span-2 font-medium">{selectedNotif.passengerName || selectedNotif.metadata?.passengerName}</span>
                </div>
              )}
              {(selectedNotif.parentName || selectedNotif.metadata?.parentName) && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground font-medium">Parent Name:</span>
                  <span className="col-span-2">{selectedNotif.parentName || selectedNotif.metadata?.parentName}</span>
                </div>
              )}
              {(selectedNotif.className || selectedNotif.metadata?.className) && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground font-medium">Class:</span>
                  <span className="col-span-2">{selectedNotif.className || selectedNotif.metadata?.className}</span>
                </div>
              )}
              {(selectedNotif.senderName) && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground font-medium">Sender:</span>
                  <span className="col-span-2">{selectedNotif.senderName} ({selectedNotif.senderRole})</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t">
                <span className="text-muted-foreground font-medium">Status:</span>
                <span className={`col-span-2 uppercase font-semibold ${selectedNotif.status === "approved" || selectedNotif.readAt ? "text-green-600" : "text-orange-500"}`}>
                  {selectedNotif.status === "approved" || selectedNotif.readAt ? "SEEN / APPROVED" : "PENDING REVIEW"}
                </span>
              </div>
            </div>

            <div className="mt-4 p-4 border rounded-lg bg-white shadow-sm">
              <p className="text-sm whitespace-pre-wrap">{selectedNotif.body}</p>
            </div>

            <DialogFooter className="mt-6 flex-col sm:flex-col gap-2">
              {(!selectedNotif.readAt && selectedNotif.status !== 'approved') ? (
                <Button 
                  onClick={handleAction} 
                  disabled={readMutation.isPending || approveMutation.isPending}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  {(selectedNotif.type === "absent" || selectedNotif.title.toLowerCase().includes("leave")) 
                    ? "Approve Application ✓" 
                    : "Mark as Read ✓"}
                </Button>
              ) : (
                <Button disabled variant="outline" className="w-full text-green-600 border-green-200 bg-green-50">
                  Already Seen / Approved ✓
                </Button>
              )}
              <Button 
                variant="ghost" 
                onClick={() => setSelectedNotif(null)}
                className="w-full"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
