-- Clean up invalid notifications
DELETE FROM notifications WHERE object_type = 'follow' AND NOT EXISTS (
  SELECT FROM follow WHERE id = notifications.object_id
);
DELETE FROM notifications WHERE object_type = 'comment' AND NOT EXISTS (
  SELECT FROM comments WHERE id = notifications.object_id
);
DELETE FROM notifications WHERE object_type = 'toast' AND NOT EXISTS (
  SELECT FROM toasts WHERE id = notifications.object_id
);
