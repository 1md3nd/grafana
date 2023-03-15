package pluginmod

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	pluginProto "github.com/grafana/grafana/pkg/plugins/pluginmod/proto"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
)

type Server struct {
	*services.BasicService

	pm  *core
	cfg *setting.Cfg
	log log.Logger
}

func newPluginManagerServer(cfg *setting.Cfg, grpcServerProvider grpcserver.Provider, coreRegistry *coreplugin.Registry,
	internalRegistry *registry.InMemory, pluginClient *client.Decorator) *Server {
	grpcSrv := grpcServerProvider.GetServer()
	s := &Server{
		pm:  NewCore(cfg, coreRegistry, internalRegistry, pluginClient),
		log: log.New("plugin.manager.server"),
	}

	pluginProto.RegisterPluginManagerServer(grpcSrv, s)
	pluginv2.RegisterDataServer(grpcSrv, s)
	pluginv2.RegisterDiagnosticsServer(grpcSrv, s)
	pluginv2.RegisterResourceServer(grpcSrv, s)
	pluginv2.RegisterStreamServer(grpcSrv, s)

	s.BasicService = services.NewBasicService(s.start, s.run, s.stop)
	s.log.Info("Creating server service...")
	return s
}

func (s *Server) start(_ context.Context) error {
	s.log.Info("Starting server...")
	return nil
}

func (s *Server) run(ctx context.Context) error {
	s.log.Info("Running server...")
	<-ctx.Done()
	return ctx.Err()
}

func (s *Server) stop(failure error) error {
	s.log.Info("Stopping server...")
	return failure
}

//func (s *Server) Plugin(ctx context.Context, pluginID string) (plugins.PluginDTO, bool) {
//	libDTO, exists := s.pm.Plugin(ctx, pluginID)
//	if !exists {
//		return plugins.PluginDTO{}, false
//	}
//
//	return toGrafanaDTO(libDTO), true
//}
//
//func (s *Server) Plugins(ctx context.Context, types ...plugins.Type) []plugins.PluginDTO {
//	libTypes := toLibTypes(types)
//
//	var res []plugins.PluginDTO
//	for _, p := range s.pm.Plugins(ctx, libTypes...) {
//		res = append(res, toGrafanaDTO(p))
//	}
//
//	return res
//}
//
//func (s *Server) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
//	return s.pm.Add(ctx, pluginID, version, plugins.CompatOpts{
//		GrafanaVersion: opts.GrafanaVersion,
//		OS:             opts.OS,
//		Arch:           opts.OS,
//	})
//}
//
//func (s *Server) Remove(ctx context.Context, pluginID string) error {
//	return s.pm.Remove(ctx, pluginID)
//}

func (s *Server) GetPlugin(ctx context.Context, req *pluginProto.GetPluginRequest) (*pluginProto.GetPluginResponse, error) {
	p, exists := s.pm.Plugin(ctx, req.Id)
	if !exists {
		return nil, errors.New("plugin not found")
	}

	return &pluginProto.GetPluginResponse{
		Plugin: toProto(p),
	}, nil
}

func (s *Server) GetPlugins(ctx context.Context, req *pluginProto.GetPluginsRequest) (*pluginProto.GetPluginsResponse, error) {
	var types []plugins.Type
	for _, t := range req.Types {
		if plugins.Type(t).IsValid() {
			types = append(types, plugins.Type(t))
		}
	}

	var ps []*pluginProto.PluginData
	for _, p := range s.pm.Plugins(ctx, toLibTypes(types)...) {
		ps = append(ps, toProto(p))
	}

	return &pluginProto.GetPluginsResponse{
		Plugins: ps,
	}, nil
}

func (s *Server) AddPlugin(ctx context.Context, req *pluginProto.AddPluginRequest) (*pluginProto.AddPluginResponse, error) {
	err := s.pm.Add(ctx, req.Id, req.Version, plugins.CompatOpts{
		GrafanaVersion: req.Opts.GrafanaVersion,
		OS:             req.Opts.Os,
		Arch:           req.Opts.Arch,
	})
	if err != nil {
		return &pluginProto.AddPluginResponse{OK: false}, err
	}
	return &pluginProto.AddPluginResponse{OK: true}, nil
}

func (s *Server) RemovePlugin(ctx context.Context, req *pluginProto.RemovePluginRequest) (*pluginProto.RemovePluginResponse, error) {
	err := s.pm.Remove(ctx, req.Id)
	if err != nil {
		return &pluginProto.RemovePluginResponse{OK: false}, err
	}
	return &pluginProto.RemovePluginResponse{OK: true}, nil
}

func (s *Server) PluginErrors(_ context.Context, _ *pluginProto.GetPluginErrorsRequest) (*pluginProto.GetPluginErrorsResponse, error) {
	var res []*pluginProto.PluginError
	for _, err := range s.pm.PluginErrors() {
		res = append(res, &pluginProto.PluginError{
			Id:    err.PluginID,
			Error: string(err.ErrorCode),
		})
	}

	return &pluginProto.GetPluginErrorsResponse{
		PluginErrors: res,
	}, nil
}

func (s *Server) StaticRoute(_ context.Context, _ *pluginProto.GetStaticRoutesRequest) (*pluginProto.GetStaticRoutesResponse, error) {
	var res []*pluginProto.StaticRoute
	for _, route := range s.pm.Routes() {
		res = append(res, &pluginProto.StaticRoute{
			Id:        route.PluginID,
			Directory: route.Directory,
		})
	}

	return &pluginProto.GetStaticRoutesResponse{
		StaticRoutes: res,
	}, nil
}

func (s *Server) QueryData(ctx context.Context, req *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
	protoResp, err := s.pm.QueryData(ctx, backend.FromProto().QueryDataRequest(req))
	if err != nil {
		return nil, err
	}

	return backend.ToProto().QueryDataResponse(protoResp)
}

func (s *Server) CallResource(req *pluginv2.CallResourceRequest, server pluginv2.Resource_CallResourceServer) error {
	fn := callResourceResponseSenderFunc(func(resp *backend.CallResourceResponse) error {
		return server.Send(backend.ToProto().CallResourceResponse(resp))
	})

	return s.pm.CallResource(server.Context(), backend.FromProto().CallResourceRequest(req), fn)
}

func (s *Server) CheckHealth(ctx context.Context, req *pluginv2.CheckHealthRequest) (*pluginv2.CheckHealthResponse, error) {
	protoResp, err := s.pm.CheckHealth(ctx, backend.FromProto().CheckHealthRequest(req))
	if err != nil {
		return nil, err
	}

	return backend.ToProto().CheckHealthResponse(protoResp), nil
}

func (s *Server) CollectMetrics(ctx context.Context, req *pluginv2.CollectMetricsRequest) (*pluginv2.CollectMetricsResponse, error) {
	protoResp, err := s.pm.CollectMetrics(ctx, backend.FromProto().CollectMetricsRequest(req))
	if err != nil {
		return nil, err
	}

	return backend.ToProto().CollectMetricsResult(protoResp), nil
}

func (s *Server) SubscribeStream(ctx context.Context, req *pluginv2.SubscribeStreamRequest) (*pluginv2.SubscribeStreamResponse, error) {
	protoResp, err := s.pm.SubscribeStream(ctx, backend.FromProto().SubscribeStreamRequest(req))
	if err != nil {
		return nil, err
	}

	return backend.ToProto().SubscribeStreamResponse(protoResp), nil
}

func (s *Server) PublishStream(ctx context.Context, req *pluginv2.PublishStreamRequest) (*pluginv2.PublishStreamResponse, error) {
	protoResp, err := s.pm.PublishStream(ctx, backend.FromProto().PublishStreamRequest(req))
	if err != nil {
		return nil, err
	}

	return backend.ToProto().PublishStreamResponse(protoResp), nil
}

func (s *Server) RunStream(req *pluginv2.RunStreamRequest, server pluginv2.Stream_RunStreamServer) error {
	sender := backend.NewStreamSender(&runStreamServer{server: server})
	return s.pm.RunStream(server.Context(), backend.FromProto().RunStreamRequest(req), sender)
}

type runStreamServer struct {
	server pluginv2.Stream_RunStreamServer
}

func (r *runStreamServer) Send(packet *backend.StreamPacket) error {
	return r.server.Send(backend.ToProto().StreamPacket(packet))
}

type callResourceResponseSenderFunc func(resp *backend.CallResourceResponse) error

func (fn callResourceResponseSenderFunc) Send(resp *backend.CallResourceResponse) error {
	return fn(resp)
}
