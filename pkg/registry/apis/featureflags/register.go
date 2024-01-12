package featureflags

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/pkg/apis/featureflags/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

var _ grafanaapiserver.APIGroupBuilder = (*FeatureFlagAPIBuilder)(nil)

var gv = v0alpha1.SchemeGroupVersion

// This is used just so wire has something unique to return
type FeatureFlagAPIBuilder struct {
	features   *featuremgmt.FeatureManager
	namespacer request.NamespaceMapper
	cfg        *setting.Cfg
}

func RegisterAPIService(cfg *setting.Cfg,
	features *featuremgmt.FeatureManager,
	apiregistration grafanaapiserver.APIRegistrar,
) *FeatureFlagAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	builder := &FeatureFlagAPIBuilder{
		features:   features,
		namespacer: request.GetNamespaceMapper(cfg),
		cfg:        cfg,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *FeatureFlagAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return gv
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&v0alpha1.Feature{},
		&v0alpha1.FeatureList{},
		&v0alpha1.FeatureToggles{},
		&v0alpha1.FeatureTogglesList{},
		&v0alpha1.ResolvedToggleState{},
	)
}

func (b *FeatureFlagAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	addKnownTypes(scheme, gv)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   gv.Group,
		Version: runtime.APIVersionInternal,
	})

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *FeatureFlagAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(v0alpha1.GROUP, scheme, metav1.ParameterCodec, codecs)

	featureStore := NewFeaturesStorage(b.features.GetFlags())
	toggleStore := NewTogglesStorage(b.features)

	storage := map[string]rest.Storage{}
	storage[featureStore.resource.StoragePath()] = featureStore
	storage[toggleStore.resource.StoragePath()] = toggleStore

	apiGroupInfo.VersionedResourcesStorageMap[v0alpha1.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *FeatureFlagAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

func (b *FeatureFlagAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

// Register additional routes with the server

func (b *FeatureFlagAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return &grafanaapiserver.APIRoutes{
		Root: []grafanaapiserver.APIRouteHandler{
			{
				Path: "resolved/status",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Summary:     "Current state",
							Description: "Shows the current flag status and interesting properties",
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {},
												},
												Description: "OK",
											},
										},
									},
								},
							},
						},
					},
				},
				Handler: b.handleResolvedStatus,
			},
			{
				Path: "resolved/enabled",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Summary:     "enabled values",
							Description: "only the enabled flags",
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {},
												},
												Description: "OK",
											},
										},
									},
								},
							},
						},
					},
				},
				Handler: b.handleResolvedEnabled,
			},
			{
				Path: "resolved/update",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Summary:     "modify",
							Description: "change values at runtime",
							Parameters: []*spec3.Parameter{
								{ParameterProps: spec3.ParameterProps{
									Name: "b",
								}},
							},
						},
					},
				},
				Handler: b.handleResolvedUpdate,
			},
		},
	}
}
