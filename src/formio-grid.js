angular.module('ngFormioGrid', [
  'formio',
  'ngSanitize',
  'ui.grid',
  'ui.grid.pagination',
  'ui.grid.resizeColumns',
  'angular-bind-html-compile'
])
.directive('formioGrid', function() {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      src: '=',
      query: '=?',
      columns: '=?',
      buttons: '=?',
      gridOptions: '=?'
    },
    template: '<div><div ui-grid="gridOptions" ui-grid-pagination ui-grid-resize-columns ui-grid-move-columns class="grid"></div></div>',
    controller: [
      'Formio',
      'formioComponents',
      'FormioUtils',
      '$scope',
      'uiGridConstants',
      function(
        Formio,
        formioComponents,
        FormioUtils,
        $scope,
        uiGridConstants
      ) {
        var formio = null;
        var paginationOptions = angular.merge({
          pageNumber: 1,
          pageSize: 25,
          sort: null
        }, $scope.gridOptions);

        $scope.buttons = $scope.buttons ||  [{
            id: 'view',
            key: 'view',
            event: 'rowView',
            label: '',
            width: 35,
            icon: 'glyphicon glyphicon-share-alt'
          }];

        if (angular.isUndefined($scope.query)) {
          $scope.query = {};
        }

        var getPage = function() {
          if (!formio) { return; }
          if (!$scope.gridOptions.columnDefs.length) { return; }
          if (paginationOptions.pageSize) {
            $scope.query.limit = paginationOptions.pageSize;
          }
          if (paginationOptions.pageNumber) {
            $scope.query.skip = (paginationOptions.pageNumber - 1) * paginationOptions.pageSize;
          }
          
          $scope.query.sort = paginationOptions.sort;
          formio.loadSubmissions({params: $scope.query}).then(function(submissions) {
            $scope.gridOptions.totalItems = submissions.serverCount;
            $scope.gridOptions.data = submissions;
          });
        };

        $scope.gridOptions = {
          paginationPageSizes: [25, 50, 75],
          paginationPageSize: paginationOptions.pageSize,
          useExternalPagination: true,
          useExternalSorting: true,
          columnDefs: [],
          data: [],
          onRegisterApi: function(gridApi) {
            $scope.gridApi = gridApi;
            gridApi.pagination.on.paginationChanged($scope, function(newPage, pageSize) {
              paginationOptions.pageNumber = newPage;
              paginationOptions.pageSize = pageSize;
              getPage();
            });
            // Ui Grid External sort code.
            gridApi.core.on.sortChanged($scope,function(grid, sortColumns) {
              if (sortColumns.length === 0) {
                paginationOptions.sort = null;
              } else {
                switch(sortColumns[0].sort.direction) {
                  case uiGridConstants.ASC:
                    paginationOptions.sort = sortColumns[0].colDef.field;
                    break;
                  case uiGridConstants.DESC:
                    paginationOptions.sort = '-'+sortColumns[0].colDef.field;
                    break;
                  case undefined:
                    paginationOptions.sort = null;
                    break;
                }
              }
              getPage();
            });
          }
        };

        $scope.buttonClick = function(event, entity) {
          $scope.$emit(event, entity);
        };

        // Load a new grid view.
        var loadGrid = function() {
          if (!$scope.src) { return; }
          formio = new Formio($scope.src);
          formio.loadForm().then(function(form) {

            var names = {};
            var increment = 1;
            $scope.gridOptions.columnDefs = [];
            $scope.buttons.forEach(function(button) {
              var btnClass = button.class || 'btn btn-sm btn-default';
              names[button.label] = true;
              $scope.gridOptions.columnDefs.push({
                name: button.label,
                field: button.key,
                width: button.width,
                cellTemplate: '<a class="' + btnClass + '" ng-click="grid.appScope.buttonClick(\'' + button.event + '\', row.entity)"><span class="' + button.icon + '" aria-hidden="true"></span>' + button.label + '</a>'
              });
            });

            var addColumn = function(component) {
              // Ensure that the labels do not collide.
              var label = component.label || component.key;
              while (names.hasOwnProperty(label)) {
                label = component.label + increment++;
              }

              names[label] = true;
              $scope.gridOptions.columnDefs.push({
                component: component,
                name: label,
                field: 'data.' + component.key,
                cellTemplate: '<div class="ui-grid-cell-contents" bind-html-compile="COL_FIELD | tableFieldView:this.col.colDef.component"></div>'
              });
            };

            if ($scope.columns && $scope.columns.length > 0) {
              var components = FormioUtils.flattenComponents(form.components);
              $scope.columns.forEach(function(key) {
                if (components.hasOwnProperty(key)) {
                  addColumn(components[key]);
                }
              });
            }
            else {
              FormioUtils.eachComponent(form.components, function(component) {
                if (component.input && component.tableView && component.key) {
                  addColumn(component);
                }
              });
            }

            getPage();
          });
        };

        $scope.$on('reloadGrid', function(event, src, query) {
          if (src) {
            $scope.src = src;
          }
          if (query) {
            $scope.query = query;
          }
          loadGrid();
        });

        loadGrid();
      }
    ]
  };
});
