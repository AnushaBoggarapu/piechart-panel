import angular from "angular";
import kbn from "app/core/utils/kbn";
import $ from "jquery";
import "jquery.flot";
import "jquery.flot.time";
import PerfectScrollbar from "./lib/perfect-scrollbar.min";

angular
  .module("grafana.directives")
  .directive("piechartLegend", function(popoverSrv, $timeout) {
    return {
      link: function(scope, elem) {
        var $container = $('<div class="piechart-legend__container"></div>');
        var firstRender = true;
        var ctrl = scope.ctrl;
        var panel = ctrl.panel;
        var data;
        var seriesList;
        var dataList;
        var i;
        var legendScrollbar;

        scope.$on("$destroy", function() {
          if (legendScrollbar) {
            legendScrollbar.destroy();
          }
        });

        ctrl.events.on("render", function() {
          data = ctrl.series;
          if (data) {
              for (var i in data) {
                data[i].color = ctrl.data[i].color;
              }
            render();
          }
        });

        function getSeriesIndexForElement(el) {
          return el.parents("[data-series-index]").data("series-index");
        }

        function toggleSeries(e) {
          var el = $(e.currentTarget);
          var index = getSeriesIndexForElement(el);
          var seriesInfo = dataList[index];
          var scrollPosition = $($container.children("tbody")).scrollTop();
          ctrl.toggleSeries(seriesInfo);
          $($container.children("tbody")).scrollTop(scrollPosition);
        }

        function sortLegend(e) {
          var el = $(e.currentTarget);
          var stat = el.data("stat");

          if (stat !== panel.legend.sort) {
            panel.legend.sortDesc = null;
          }

          // if already sort ascending, disable sorting
          if (panel.legend.sortDesc === false) {
            panel.legend.sort = null;
            panel.legend.sortDesc = null;
            ctrl.render();
            return;
          }

          panel.legend.sortDesc = !panel.legend.sortDesc;
          panel.legend.sort = stat;
          ctrl.render();
        }

        function getLegendHeaderHtml(statName) {
          var name = statName;

          if (panel.legend.header) {
            name = panel.legend.header;
          }

          var html = '<th class="pointer" data-stat="' + statName + '">' + name;

          if (panel.legend.sort === statName) {
            var cssClass = panel.legend.sortDesc
              ? "fa fa-caret-down"
              : "fa fa-caret-up";
            html += ' <span class="' + cssClass + '"></span>';
          }

          return html + "</th>";
        }

        function getLegendPercentageHtml(statName) {
          var name = "percentage";
          var html = '<th class="pointer" data-stat="' + statName + '">' + name;

          if (panel.legend.sort === statName) {
            var cssClass = panel.legend.sortDesc
              ? "fa fa-caret-down"
              : "fa fa-caret-up";
            html += ' <span class="' + cssClass + '"></span>';
          }

          return html + "</th>";
        }

        function openColorSelector(e) {
          // if we clicked inside poup container ignore click
          if ($(e.target).parents(".popover").length) {
            return;
          }

          var el = $(e.currentTarget).find(".fa-minus");
          var index = getSeriesIndexForElement(el);
          var series = seriesList[index];

          $timeout(function() {
            popoverSrv.show({
              element: el[0],
              position: "bottom center",
              template:
                '<series-color-picker series="series" onToggleAxis="toggleAxis" onColorChange="colorSelected">' +
                "</series-color-picker>",
              openOn: "hover",
              model: {
                autoClose: true,
                series: series,
                toggleAxis: function() {},
                colorSelected: function(color) {
                  ctrl.changeSeriesColor(series, color);
                }
              }
            });
          });
        }

        function render() {
          if (panel.legendType === "On graph") {
            $container.empty();
            $(".piechart-legend").css("padding-top", 0);
            return;
          } else {
            $(".piechart-legend").css("padding-top", 6);
          }

          if (firstRender) {
            elem.append($container);
            $container.on("click", ".piechart-legend-icon", openColorSelector);
            $container.on("click", ".piechart-legend-alias", toggleSeries);
            $container.on("click", "th", sortLegend);
            firstRender = false;
          }

          seriesList = data;
          dataList = ctrl.data;

          $container.empty();

          var width =
            panel.legendType == "Right side" && panel.legend.sideWidth
              ? panel.legend.sideWidth + "px"
              : "";
          $container.css("min-width", width);

          var showValues = panel.legend.values || panel.legend.percentage;
          var tableLayout =
            (panel.legendType === "Under graph" ||
              panel.legendType === "Right side") &&
            showValues;

          $container.toggleClass("piechart-legend-table", tableLayout);

          var legendHeader;
          if (tableLayout) {
            var header = '<tr><th colspan="2" style="text-align:left"></th>';
            if (panel.legend.values) {
              header += getLegendHeaderHtml(ctrl.panel.valueName);
            }
            if (panel.legend.percentage) {
              header += getLegendPercentageHtml(ctrl.panel.valueName);
            }
            header += "</tr>";
            legendHeader = $(header);
          }

          if (panel.legend.percentage) {
            var total = 0;
            for (i = 0; i < seriesList.length; i++) {
              total += seriesList[i].stats[ctrl.panel.valueName];
            }
          }

          var seriesShown = 0;
          var seriesElements = [];

          for (i = 0; i < seriesList.length; i++) {
            var series = seriesList[i];
            var seriesData = dataList[i];

            // ignore empty series
            if (panel.legend.hideEmpty && series.allIsNull) {
              continue;
            }
            // ignore series excluded via override
            if (!series.legend) {
              continue;
            }

            var decimal = 0;
            if (ctrl.panel.legend.percentageDecimals) {
              decimal = ctrl.panel.legend.percentageDecimals;
            }

            var html = '<div class="piechart-legend-series';
            if (ctrl.hiddenSeries[seriesData.label]) {
              html += " piechart-legend-series-hidden";
            }
            html += '" data-series-index="' + i + '">';
            html += '<span class="piechart-legend-icon" style="float:none;">';
            html +=
              '<i class="fa fa-minus pointer" style="color:' +
              seriesData.color +
              '"></i>';
            html += "</span>";

            html +=
              '<a class="piechart-legend-alias" style="float:none;">' +
              seriesData.label +
              "</a>";

            if (showValues && tableLayout) {
              var value = seriesData.legendData;
              if (panel.legend.values) {
                html +=
                  '<div class="piechart-legend-value">' +
                  ctrl.formatValue(value) +
                  "</div>";
              }
              if (total) {
                var pvalue = (value / total * 100).toFixed(decimal) + "%";
                html += '<div class="piechart-legend-value">' + pvalue + "</div>";
              }
            }

            html += "</div>";

            seriesElements.push($(html));
            seriesShown++;
          }
          if (tableLayout) {
            var topPadding = 6;
            var tbodyElem = $("<tbody></tbody>");
            // tbodyElem.css("max-height", maxHeight - topPadding);
            tbodyElem.append(legendHeader);
            tbodyElem.append(seriesElements);
            $container.append(tbodyElem);
          } else {
            $container.append(seriesElements);
          }

          if (panel.legendType === "Under graph") {
            addScrollbar();
          } else {
            destroyScrollbar();
          }
        }
        function addScrollbar() {
          const scrollbarOptions = {
            // Number of pixels the content height can surpass the container height without enabling the scroll bar.
            scrollYMarginOffset: 2,
            suppressScrollX: true
          };

          if (!legendScrollbar) {
            legendScrollbar = new PerfectScrollbar(
              ".piechart-legend",
              scrollbarOptions
            );
          } else {
            legendScrollbar.update();
          }
        }

        function destroyScrollbar() {
          if (legendScrollbar) {
            legendScrollbar.destroy();
            legendScrollbar = null;
          }
        }
      }
    };
  });
