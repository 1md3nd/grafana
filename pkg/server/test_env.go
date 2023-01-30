package server

import (
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideTestEnv(
	server *Server,
	httpServer *api.HTTPServer,
	store *sqlstore.SQLStore,
	ns *notifications.NotificationServiceMock,
	grpcServer grpcserver.Provider,
	pluginRegistry registry.Service,
	httpClientProvider httpclient.Provider,
	oAuthTokenService *oauthtokentest.Service,
	roleRegistry accesscontrol.RoleRegistry,
) (*TestEnv, error) {
	return &TestEnv{
		server,
		httpServer,
		store,
		ns,
		grpcServer,
		pluginRegistry,
		httpClientProvider,
		oAuthTokenService,
		roleRegistry,
	}, nil
}

type TestEnv struct {
	Server              *Server
	HTTPServer          *api.HTTPServer
	SQLStore            *sqlstore.SQLStore
	NotificationService *notifications.NotificationServiceMock
	GRPCServer          grpcserver.Provider
	PluginRegistry      registry.Service
	HTTPClientProvider  httpclient.Provider
	OAuthTokenService   *oauthtokentest.Service
	RoleRegistry        accesscontrol.RoleRegistry
}
