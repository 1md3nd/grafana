package kinds

import (
	"reflect"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource/schemabuilder"
	"github.com/stretchr/testify/require"
)

func TestQueryTypeDefinitions(t *testing.T) {
	builder, err := schemabuilder.NewSchemaBuilder(
		schemabuilder.BuilderOptions{
			PluginID: []string{"grafana-testdata-datasource", "testdata"},
			ScanCode: []schemabuilder.CodePaths{{
				BasePackage: "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource/kinds",
				CodePath:    "./",
			}},
			Enums: []reflect.Type{
				reflect.TypeOf(NodesQueryTypeRandom),         // pick an example value (not the root)
				reflect.TypeOf(StreamingQueryTypeFetch),      // pick an example value (not the root)
				reflect.TypeOf(ErrorTypeServerPanic),         // pick an example value (not the root)
				reflect.TypeOf(TestDataQueryTypeAnnotations), // pick an example value (not the root)
			},
		})
	require.NoError(t, err)
	err = builder.AddQueries(
		schemabuilder.QueryTypeInfo{
			Name:     "default",
			GoType:   reflect.TypeOf(&TestDataDataQuery{}),
			Examples: []resource.QueryExample{
				// {
				// 	Name: "example timeseries",
				// 	SaveModel: resource.AsUnstructured(TestDataDataQuery{
				// 		ScenarioId: TestDataQueryTypeManualEntry,
				// 	}),
				// },
			},
		},
	)

	require.NoError(t, err)
	builder.UpdateQueryDefinition(t, "./")
}