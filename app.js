if (window.File && window.FileReader && window.FileList && window.Blob) {
  //Great success! All the File APIs are supported.
} else {
  alert('The File APIs are not fully supported in this browser.');
}

$(function(){
  var Image = Backbone.Model.extend({
    initialize: function(file){
      this.set({file:file});
    },
    setUrl: function(url){
      this.set({url:url});
    }
  });

  var Scene = Backbone.Model.extend({
    initialize: function(startImage,endImage){
      this.set({startImage:startImage, endImage:endImage});
    },
    filenames: function(){
      return {
        start: this.get('startImage').get('file').name,
        end: this.get('endImage').get('file').name
      }
    }
  });

  var Cluster = Backbone.Model.extend({
    initialize: function(scene){
      this.set({scenes: [scene]});
    },
    select: function() {
      this.set({selected:true});
    },
    unselect: function() {
      this.set({selected:false});
    },
    scenes: function(){
      return this.get('scenes');
    },
    addScenes: function(scenes){
      var that = this;
      _.each(scenes, function(scene){ that.addScene(scene) });
    },
    addScene: function(scene){
      this.get('scenes').push(scene);
      this.trigger('add',scene);
    },
    merge: function(anotherCluster){
      this.addScenes(anotherCluster.scenes());
      anotherCluster.destroy();
    },
    filenames: function(){
      return _.map(this.get('scenes'), function(scene) { return scene.filenames() });
    }
  });

  var ClusterList = Backbone.Collection.extend({
    model: Cluster,
    setSelected: function(cluster){
      if(!this.selectedCluster()){
        cluster.select();
      } else if (this.selectedCluster() === cluster) {
        cluster.unselect();
      } else {
        var clusterToMerge = this.selectedCluster(); 
        clusterToMerge.unselect();
        cluster.merge(clusterToMerge);
      }
    },
    selectedCluster: function(){
      return this.where({selected:true})[0];
    }
  });

  var ImageList = Backbone.Collection.extend({
    model: Image
  });

  var Images = new ImageList();
  var Clusters = new ClusterList();

  var ClusterView = Backbone.View.extend({
    //Ideally Cluster would have been a collection, but since ClusterList already is one it doesn't work!
    tagName: "div",
    className: "cluster",
    events: {
      "click": "select"
    },
    initialize: function(){
      this.model.bind('change', this.render, this);
      this.model.bind('destroy', this.remove, this);
      this.model.bind('add', this.addOne, this);
      this.firstTime = true; //Working around the fact that Cluster isn't a Collection
    },
    render: function() {
      if(this.firstTime){
        var sceneView = new SceneView({model: this.model.get('scenes')[0]});
        this.$el.append(sceneView.render().$el);
        this.firstTime = false;
      }
      if(this.model.get('selected') && !this.$el.hasClass('selected')){
        this.$el.addClass('selected');
      } else if (!this.model.get('selected') && this.$el.hasClass('selected')) {
        this.$el.removeClass('selected');
      }
      return this;
    },
    select: function(){
      Clusters.setSelected(this.model);
    },
    addOne: function(scene){
      var newSceneView = new SceneView({model: scene}).render().$el; //Ideally I would just transfer the old view
      newSceneView.addClass('miniature');
      this.$el.append(newSceneView);
    }
  });

  var SceneView = Backbone.View.extend({
    tagName: "div",
    className: "scene",
    render: function() {
      var startImageView = new ImageView({model: this.model.get('startImage')});
      var endImageView = new ImageView({model: this.model.get('endImage')});
      this.$el.append(startImageView.render().$el);
      this.$el.append("...");
      this.$el.append(endImageView.render().$el);
      return this;
    },
  });

  var ImageView = Backbone.View.extend({
    tagName: "span",
    className: "image",
    initialize: function(){
      this.model.bind('change', this.render, this); 
    },
    template: _.template('<img src="<%= imageSrc %>"/>'),
    render: function() {
      if(this.model.get('url')){
        this.$el.html(this.template({name: this.model.get('name'), imageSrc:this.model.get('url')}));
      } else {
        this.$el.text("Loading...");
      }
      return this;
    }
  });

  var DropZoneView = Backbone.View.extend({
    el: $('#drop_zone'),
    events: {
      "drop": "uploadFile",
      "dragover": "handleDragOver",
      "dragleave": "handleDragLeave"
    },
    uploadFile: function(evt){
      evt.stopPropagation();
      evt.preventDefault();
      var files = evt.originalEvent.dataTransfer.files;
      if(this.allImages(files)){
        this.addImagesToModel(files);
      } else {
        this.showErrorMessage("At least one of the files you added was not an image. Please, try again.");
      }
    },
    
    addImagesToModel: function(files) {
      $(this.el).hide();
      _.map(files, function(file){
        var reader = new FileReader();
        var image = new Image(file);
        Images.add(image)
        reader.onload = (function(theImage){
          return function(event){
            theImage.setUrl(event.target.result)
          }
        })(image);
        reader.readAsDataURL(file);
      }); 
      for(var i=0; i<Images.length; i+=2){
        var scene = new Scene(Images.at(i),Images.at(i+1));
        Clusters.add(new Cluster(scene));
      }
    },

    showErrorMessage: function(text) {
      this.$el.text(text);
      if(!this.$el.hasClass("error")){
        this.$el.addClass("error"); 
      }
    },

    handleDragOver: function(evt) {
      var event = evt.originalEvent; 
      event.stopPropagation();
      event.preventDefault();
      this.resetDragZone();
      event.dataTransfer.dropEffect = 'link'; // Explicitly show this is a link.
      $(this.el).text('Just like that!');
      $(this.el).addClass('files_hovering_over');
    },

    allImages: function(files) {
      var imageType = /image.*/;  
      return _.reduce(files, function(memo,file){ return (memo && file.type.match(imageType)) }, true);
    },

    handleDragLeave: function(evt) {
      var event = evt.originalEvent; 
      event.stopPropagation();
      event.preventDefault();
      this.resetDragZone();
    },

    resetDragZone: function(){
      $(this.el).removeClass('files_hovering_over');
      $(this.el).removeClass('error');
      this.$el.text("Drop image files here to get started!");
    }
  });

  var AppView = Backbone.View.extend({
    el: $('body'),
    initialize: function(){
      this.dropZone = new DropZoneView;
      this.clusterList = this.$("#list");
      this.footer = this.$("#footer");
      this.save_to_file_link = this.footer.children('#save_to_file');
      this.number_of_clusters = this.footer.children('#number_of_clusters');
      Clusters.bind('add', this.addOne, this);
      Clusters.bind('remove', this.render, this);
      this.save_to_file_link.hide();
      this.render();
    },
    events:{
      "click #save_to_file": "save_to_file"
    },
    render: function(){
      this.number_of_clusters.text(Clusters.length + " clusters");
    },
    addOne: function(cluster){
      var view = new ClusterView({model:cluster});
      $(this.clusterList).append(view.render().$el);
      if(Clusters.length) {
        this.save_to_file_link.show();
      }
      this.render();
    },
    save_to_file: function(){
      var content = Clusters.map(function(cluster){ return cluster.filenames() });
      uriContent = "data:application/octet-stream," + encodeURIComponent(JSON.stringify(content));
      window.open(uriContent);
    }

  });

  var App = new AppView;

});
