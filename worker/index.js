'use strict';

self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Você tem uma nova notificação.',
      icon: '/icon-192x192.png', // Certifique-se de que este ícone existe na pasta public
      badge: '/icon-192x192.png', // Opcional: crie um ícone monocromático para o badge do Android
      data: {
        url: data.url || '/dashboard/escalas',
      },
      vibrate: [200, 100, 200],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Sistema de Escalas', options)
    );
  } catch (error) {
    console.error('Erro ao processar payload do push', error);
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  
  const targetUrl = event.notification.data.url || '/dashboard/escalas';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se o app já estiver aberto, foca na aba e navega para a URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não estiver aberto, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});