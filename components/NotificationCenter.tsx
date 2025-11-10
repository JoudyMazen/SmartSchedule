import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, ListGroup, Modal } from 'react-bootstrap';
import { useRouter } from 'next/router';

interface Notification {
  id: string;
  type: 'comment' | 'update' | 'publish' | 'version' | 'feedback';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
  userId?: number;
  userName?: string;
}

interface NotificationCenterProps {
  userId: number;
  role: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId, role }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 10 seconds for faster updates
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [userId]);
  
  // Also refresh when modal is opened
  useEffect(() => {
    if (showModal) {
      fetchNotifications();
    }
  }, [showModal, userId]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`/api/notifications?user_id=${userId}`);
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, mark_all: true }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      router.push(notification.link);
      setShowModal(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return '💬';
      case 'update':
        return '🔄';
      case 'publish':
        return '📢';
      case 'version':
        return '📝';
      default:
        return '🔔';
    }
  };

  return (
    <>
      <Button
        variant="outline-light"
        className="position-relative"
        onClick={() => setShowModal(true)}
        style={{ border: 'none' }}
      >
        <i className="bi bi-bell fs-5"></i>
        {unreadCount > 0 && (
          <Badge
            bg="danger"
            className="position-absolute top-0 start-100 translate-middle rounded-pill"
            style={{ fontSize: '0.7rem' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton style={{ background: '#1e3a5f', color: 'white' }}>
          <Modal.Title>
            Notifications
            {unreadCount > 0 && (
              <Badge bg="danger" className="ms-2">{unreadCount} unread</Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto', padding: 0 }}>
          {notifications.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-bell-slash fs-1 d-block mb-3"></i>
              <p>No notifications</p>
            </div>
          ) : (
            <>
              {unreadCount > 0 && (
                <div className="p-3 border-bottom">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={markAllAsRead}
                  >
                    Mark all as read
                  </Button>
                </div>
              )}
              <ListGroup variant="flush">
                {notifications.map((notification) => (
                  <ListGroup.Item
                    key={notification.id}
                    action
                    onClick={() => handleNotificationClick(notification)}
                    className={!notification.read ? 'bg-light' : ''}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center mb-1">
                          <span className="me-2 fs-5">
                            {getNotificationIcon(notification.type)}
                          </span>
                          <strong className={!notification.read ? 'fw-bold' : ''}>
                            {notification.title}
                          </strong>
                          {!notification.read && (
                            <Badge bg="primary" className="ms-2">New</Badge>
                          )}
                        </div>
                        <p className="mb-1 text-muted small">{notification.message}</p>
                        {notification.userName && (
                          <small className="text-muted">
                            by {notification.userName}
                          </small>
                        )}
                        <small className="text-muted d-block mt-1">
                          {new Date(notification.timestamp).toLocaleString()}
                        </small>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                      >
                        <i className="bi bi-x"></i>
                      </Button>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default NotificationCenter;


