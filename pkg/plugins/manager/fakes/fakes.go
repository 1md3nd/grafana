package fakes

import (
	"archive/zip"
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
)

type FakePluginClient struct {
	backend.QueryDataHandlerFunc
	backend.CheckHealthHandlerFunc
	backend.StreamHandler
	backend.CallResourceHandlerFunc
	backend.CollectMetricsHandlerFunc
}

type FakePluginStore struct {
	GetFunc func(ctx context.Context, pluginID string) (plugins.PluginDTO, bool)
	// Plugins returns plugins by their requested type.
	ListFunc func(ctx context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO
}

func (s *FakePluginStore) Plugin(ctx context.Context, pluginID string) (plugins.PluginDTO, bool) {
	if s.GetFunc != nil {
		return s.GetFunc(ctx, pluginID)
	}
	return plugins.PluginDTO{}, false
}

func (s *FakePluginStore) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	if s.ListFunc != nil {
		return s.ListFunc(ctx, pluginTypes...)
	}
	return nil
}

type FakePluginInstaller struct {
	AddFunc func(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error
	// Remove removes a plugin from the store.
	RemoveFunc func(ctx context.Context, pluginID string) error
}

func (i *FakePluginInstaller) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
	if i.AddFunc != nil {
		return i.AddFunc(ctx, pluginID, version, opts)
	}
	return nil
}

func (i *FakePluginInstaller) Remove(ctx context.Context, pluginID string) error {
	if i.RemoveFunc != nil {
		return i.RemoveFunc(ctx, pluginID)
	}
	return nil
}

type FakeLoader struct {
	LoadFunc   func(_ context.Context, _ plugins.Class, paths []string) ([]*plugins.Plugin, error)
	UnloadFunc func(_ context.Context, _ string) error
}

func (l *FakeLoader) Load(ctx context.Context, class plugins.Class, paths []string) ([]*plugins.Plugin, error) {
	if l.LoadFunc != nil {
		return l.LoadFunc(ctx, class, paths)
	}
	return nil, nil
}

func (l *FakeLoader) Unload(ctx context.Context, pluginID string) error {
	if l.UnloadFunc != nil {
		return l.UnloadFunc(ctx, pluginID)
	}
	return nil
}

type FakePluginBackend struct {
	ID      string
	Managed bool
	Log     log.Logger

	startCount     int
	stopCount      int
	exited         bool
	decommissioned bool
	backend.CollectMetricsHandlerFunc
	backend.CheckHealthHandlerFunc
	backend.QueryDataHandlerFunc
	backend.CallResourceHandlerFunc
	mutex sync.RWMutex

	backendplugin.Plugin
}

func (pc *FakePluginBackend) PluginID() string {
	return pc.ID
}

func (pc *FakePluginBackend) Logger() log.Logger {
	return pc.Log
}

func (pc *FakePluginBackend) Start(_ context.Context) error {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()
	pc.exited = false
	pc.startCount++
	return nil
}

func (pc *FakePluginBackend) Stop(_ context.Context) error {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()
	pc.stopCount++
	pc.exited = true
	return nil
}

func (pc *FakePluginBackend) IsManaged() bool {
	return pc.Managed
}

func (pc *FakePluginBackend) Exited() bool {
	pc.mutex.RLock()
	defer pc.mutex.RUnlock()
	return pc.exited
}

func (pc *FakePluginBackend) Decommission() error {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()
	pc.decommissioned = true
	return nil
}

func (pc *FakePluginBackend) IsDecommissioned() bool {
	pc.mutex.RLock()
	defer pc.mutex.RUnlock()
	return pc.decommissioned
}

func (pc *FakePluginBackend) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if pc.CollectMetricsHandlerFunc != nil {
		return pc.CollectMetricsHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *FakePluginBackend) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if pc.CheckHealthHandlerFunc != nil {
		return pc.CheckHealthHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *FakePluginBackend) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if pc.QueryDataHandlerFunc != nil {
		return pc.QueryDataHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *FakePluginBackend) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if pc.CallResourceHandlerFunc != nil {
		return pc.CallResourceHandlerFunc(ctx, req, sender)
	}

	return backendplugin.ErrMethodNotImplemented
}

func (pc *FakePluginBackend) SubscribeStream(_ context.Context, _ *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *FakePluginBackend) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *FakePluginBackend) RunStream(_ context.Context, _ *backend.RunStreamRequest, _ *backend.StreamSender) error {
	return backendplugin.ErrMethodNotImplemented
}

type FakePluginRegistry struct {
	Store map[string]*plugins.Plugin
}

func NewFakePluginRegistry() *FakePluginRegistry {
	return &FakePluginRegistry{
		Store: make(map[string]*plugins.Plugin),
	}
}

func (f *FakePluginRegistry) Plugin(_ context.Context, id string) (*plugins.Plugin, bool) {
	p, exists := f.Store[id]
	return p, exists
}

func (f *FakePluginRegistry) Plugins(_ context.Context) []*plugins.Plugin {
	var res []*plugins.Plugin

	for _, p := range f.Store {
		res = append(res, p)
	}

	return res
}

func (f *FakePluginRegistry) Add(_ context.Context, p *plugins.Plugin) error {
	f.Store[p.ID] = p
	return nil
}

func (f *FakePluginRegistry) Remove(_ context.Context, id string) error {
	delete(f.Store, id)
	return nil
}

type FakePluginRepo struct {
	GetPluginArchiveFunc         func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginArchive, error)
	GetPluginArchiveByURLFunc    func(_ context.Context, archiveURL string, _ repo.CompatOpts) (*repo.PluginArchive, error)
	GetPluginDownloadOptionsFunc func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginDownloadOptions, error)
}

// GetPluginArchive fetches the requested plugin archive.
func (r *FakePluginRepo) GetPluginArchive(ctx context.Context, pluginID, version string, opts repo.CompatOpts) (*repo.PluginArchive, error) {
	if r.GetPluginArchiveFunc != nil {
		return r.GetPluginArchiveFunc(ctx, pluginID, version, opts)
	}

	return &repo.PluginArchive{}, nil
}

// GetPluginArchiveByURL fetches the requested plugin from the specified URL.
func (r *FakePluginRepo) GetPluginArchiveByURL(ctx context.Context, archiveURL string, opts repo.CompatOpts) (*repo.PluginArchive, error) {
	if r.GetPluginArchiveByURLFunc != nil {
		return r.GetPluginArchiveByURLFunc(ctx, archiveURL, opts)
	}

	return &repo.PluginArchive{}, nil
}

// GetPluginDownloadOptions fetches information for downloading the requested plugin.
func (r *FakePluginRepo) GetPluginDownloadOptions(ctx context.Context, pluginID, version string, opts repo.CompatOpts) (*repo.PluginDownloadOptions, error) {
	if r.GetPluginDownloadOptionsFunc != nil {
		return r.GetPluginDownloadOptionsFunc(ctx, pluginID, version, opts)
	}
	return &repo.PluginDownloadOptions{}, nil
}

type FakePluginStorage struct {
	Store        map[string]struct{}
	AddFunc      func(_ context.Context, pluginID string, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error)
	RegisterFunc func(_ context.Context, pluginID, pluginDir string) error
	RemoveFunc   func(_ context.Context, pluginID string) error
}

func NewFakePluginStorage() *FakePluginStorage {
	return &FakePluginStorage{
		Store: map[string]struct{}{},
	}
}

func (s *FakePluginStorage) Register(ctx context.Context, pluginID, pluginDir string) error {
	s.Store[pluginID] = struct{}{}
	if s.RegisterFunc != nil {
		return s.RegisterFunc(ctx, pluginID, pluginDir)
	}
	return nil
}

func (s *FakePluginStorage) Add(ctx context.Context, pluginID string, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
	s.Store[pluginID] = struct{}{}
	if s.AddFunc != nil {
		return s.AddFunc(ctx, pluginID, z)
	}
	return &storage.ExtractedPluginArchive{}, nil
}

func (s *FakePluginStorage) Remove(ctx context.Context, pluginID string) error {
	delete(s.Store, pluginID)
	if s.RemoveFunc != nil {
		return s.RemoveFunc(ctx, pluginID)
	}
	return nil
}

type FakeProcessManager struct {
	StartFunc func(_ context.Context, pluginID string) error
	StopFunc  func(_ context.Context, pluginID string) error
	Started   map[string]int
	Stopped   map[string]int
}

func NewFakeProcessManager() *FakeProcessManager {
	return &FakeProcessManager{
		Started: make(map[string]int),
		Stopped: make(map[string]int),
	}
}

func (m *FakeProcessManager) Start(ctx context.Context, pluginID string) error {
	m.Started[pluginID]++
	if m.StartFunc != nil {
		return m.StartFunc(ctx, pluginID)
	}
	return nil
}

func (m *FakeProcessManager) Stop(ctx context.Context, pluginID string) error {
	m.Stopped[pluginID]++
	if m.StopFunc != nil {
		return m.StopFunc(ctx, pluginID)
	}
	return nil
}

func (m *FakeProcessManager) Shutdown(_ context.Context) error {
	return nil
}

type FakeBackendProcessProvider struct {
	Requested map[string]int
	Invoked   map[string]int
}

func NewFakeBackendProcessProvider() *FakeBackendProcessProvider {
	return &FakeBackendProcessProvider{
		Requested: make(map[string]int),
		Invoked:   make(map[string]int),
	}
}

func (pr *FakeBackendProcessProvider) BackendFactory(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
	pr.Requested[p.ID]++
	return func(pluginID string, _ log.Logger, _ []string) (backendplugin.Plugin, error) {
		pr.Invoked[pluginID]++
		return &FakePluginBackend{}, nil
	}
}

type FakeLicensingService struct {
	LicenseEdition string
	TokenRaw       string
	LicensePath    string
}

func NewFakeLicensingService() *FakeLicensingService {
	return &FakeLicensingService{}
}

func (s *FakeLicensingService) Edition() string {
	return s.LicenseEdition
}

func (s *FakeLicensingService) Path() string {
	return s.LicensePath
}

func (s *FakeLicensingService) Environment() []string {
	return []string{fmt.Sprintf("GF_ENTERPRISE_LICENSE_TEXT=%s", s.TokenRaw)}
}

type FakeRoleRegistry struct {
	ExpectedErr error
}

func NewFakeRoleRegistry() *FakeRoleRegistry {
	return &FakeRoleRegistry{}
}

func (f *FakeRoleRegistry) DeclarePluginRoles(_ context.Context, _ string, _ string, _ []plugins.RoleRegistration) error {
	return f.ExpectedErr
}

type FakeSources struct {
	ListFunc func(_ context.Context) []plugins.PluginSource
}

func (s *FakeSources) List(ctx context.Context) []plugins.PluginSource {
	if s.ListFunc != nil {
		return s.ListFunc(ctx)
	}
	return []plugins.PluginSource{}
}
